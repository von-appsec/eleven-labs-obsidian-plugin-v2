import {
    Editor,
    MarkdownView,
    Plugin,
    Menu,
    MarkdownFileInfo,
    Notice,
    setIcon,
} from "obsidian";
import {
    ElevenLabsPluginSettings,
    DEFAULT_SETTINGS,
    DEFAULT_MODEL_ID,
    ElevenLabsSettingTab,
    ElevenLabsSecrets,
    DEFAULT_SECRETS,
} from "./src/settings";
import ElevenLabsApi from "./src/eleven_labs_api";
import { Alignment } from "./src/util/audio";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { setTTSHighlight, ttsHighlightField } from "./src/tts-highlight";

interface WordRange {
    from: number;
    to: number;
    startTime: number;
    endTime: number;
}

type AudioState = "idle" | "loading" | "playing" | "paused";

export default class ElevenLabsPlugin extends Plugin {
    settings: ElevenLabsPluginSettings;
    secrets: ElevenLabsSecrets;
    voices: any[];
    models: any[];

    currentAudio: HTMLAudioElement | null = null;
    audioState: AudioState = "idle";
    private currentBlobUrl: string | null = null;
    private ttsEditorView: EditorView | null = null;
    private ribbonIconEl: HTMLElement | null = null;
    private wordRanges: WordRange[] = [];
    private rafId: number | null = null;

    // Persisted selection — populated by a CM6 ViewPlugin whenever the user
    // makes a non-empty selection. Used as fallback on Android where tapping
    // the ribbon dismisses the keyboard and clears the live selection before
    // the callback fires.
    private savedText: string = "";
    private savedSelFrom: number = 0;
    private savedCmEditor: EditorView | null = null;

    addContextMenuItems = (
        menu: Menu,
        _editor: Editor,
        _info: MarkdownView | MarkdownFileInfo
    ) => {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        const selectedText = markdownView?.editor.getSelection();

        if (this.audioState === "playing") {
            menu.addItem((item) =>
                item.setTitle("Pause").setIcon("pause").onClick(() => this.handlePause())
            );
            if (selectedText) {
                menu.addItem((item) =>
                    item.setTitle("Generate new audio").setIcon("audio-lines").onClick(() => this.handleGenerateNew())
                );
            }
        } else if (this.audioState === "paused") {
            menu.addItem((item) =>
                item.setTitle("Resume").setIcon("play").onClick(() => this.handleResume())
            );
            if (selectedText) {
                menu.addItem((item) =>
                    item.setTitle("Generate new audio").setIcon("audio-lines").onClick(() => this.handleGenerateNew())
                );
            }
        } else if (this.audioState === "idle") {
            if (selectedText) {
                menu.addItem((item) =>
                    item.setTitle("Read aloud").setIcon("audio-lines").onClick(() => this.handleGenerateNew())
                );
            }
        }
    };

    registerTTSEditorExtension() {
        // Capture selection state on every selection change so the ribbon trigger
        // on Android can fall back to the last known selection (the live selection
        // is gone by the time the ribbon callback fires on mobile).
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const plugin = this;
        const selectionTracker = ViewPlugin.fromClass(
            class {
                update(update: ViewUpdate) {
                    if (!update.selectionSet) return;
                    const sel = update.state.selection.main;
                    if (sel.empty) return;
                    const text = update.state.sliceDoc(sel.from, sel.to);
                    if (!text.trim()) return;
                    plugin.savedText = text;
                    plugin.savedSelFrom = sel.from;
                    plugin.savedCmEditor = update.view;
                }
            }
        );
        this.registerEditorExtension([ttsHighlightField, selectionTracker]);
    }

    private stopAndReset() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.onended = null;
            this.currentAudio = null;
        }
        if (this.currentBlobUrl) {
            URL.revokeObjectURL(this.currentBlobUrl);
            this.currentBlobUrl = null;
        }
        this.stopRAF();
        this.clearTTSHighlight();
        this.wordRanges = [];
        this.audioState = "idle";
    }

    handlePause() {
        if (this.audioState !== "playing") return;
        this.currentAudio!.pause();
        this.audioState = "paused";
        this.updateRibbonIcon();
    }

    async handleResume() {
        if (this.audioState !== "paused") return;
        await this.currentAudio!.play();
        this.audioState = "playing";
        this.updateRibbonIcon();
    }

    async handleGenerateNew() {
        if (this.audioState === "loading") return;
        if (this.audioState === "playing" || this.audioState === "paused") {
            this.stopAndReset();
        }
        await this.generateAndPlay();
    }

    // Ribbon left-click: pure pause/resume toggle; idle falls through to generate.
    async handleTTSTrigger() {
        if (this.audioState === "playing") {
            this.handlePause();
            return;
        }
        if (this.audioState === "paused") {
            await this.handleResume();
            return;
        }
        if (this.audioState === "idle") {
            await this.handleGenerateNew();
        }
    }

    private async generateAndPlay() {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        const liveText = markdownView?.editor.getSelection() ?? "";
        const selectedText = liveText || this.savedText;

        if (!selectedText) {
            new Notice("Eleven Labs: Select text in a note first.", 3000);
            return;
        }

        const voiceId = this.settings.selectedVoiceId;
        const modelId = this.settings.selectedModelId ?? DEFAULT_MODEL_ID;
        if (!voiceId) {
            new Notice("Eleven Labs: Select a voice in Settings.", 5000);
            return;
        }

        // Resolve CM6 editor and selection-start offset:
        // prefer the live editor when text is freshly selected; use the saved
        // editor reference when falling back to the Android saved-selection path.
        const liveCm = (markdownView?.editor as any)?.cm as EditorView | undefined;
        const cmEditor = liveCm ?? this.savedCmEditor ?? undefined;
        const selFrom = (liveText && liveCm)
            ? liveCm.state.selection.main.from
            : this.savedSelFrom;

        this.audioState = "loading";
        this.updateRibbonIcon();

        // Timeout 0 keeps the notice pinned until we manually hide it, so
        // mobile users can see it for the full duration of the API call.
        const generatingNotice = new Notice("Eleven Labs: Generating audio...", 0);

        try {
            const voiceSettingsEntry = this.settings.voiceSettings?.[voiceId];
            const voiceOptions = voiceSettingsEntry?.enabled ? voiceSettingsEntry : undefined;

            const response = await ElevenLabsApi.textToSpeechWithTimestamps(
                this.secrets.apiKey,
                selectedText,
                voiceId,
                modelId,
                voiceOptions,
            );

            if (response.status !== 200) {
                generatingNotice.hide();
                this.audioState = "idle";
                this.updateRibbonIcon();
                new Notice("Eleven Labs: Failed to generate audio. Check your API key.", 5000);
                return;
            }

            const { audio_base64, alignment } = response.json as {
                audio_base64: string;
                alignment: Alignment;
            };

            // Decode base64 audio — works cross-platform without Node.js APIs
            const binaryString = atob(audio_base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const blob = new Blob([bytes], { type: "audio/mpeg" });
            const blobUrl = URL.createObjectURL(blob);
            const audio = new Audio(blobUrl);

            this.currentAudio = audio;
            this.currentBlobUrl = blobUrl;

            if (cmEditor) {
                this.ttsEditorView = cmEditor;
                this.wordRanges = this.buildWordRanges(alignment, selFrom);
            }

            audio.onended = () => {
                this.stopRAF();
                URL.revokeObjectURL(blobUrl);
                this.currentAudio = null;
                this.currentBlobUrl = null;
                this.wordRanges = [];
                this.audioState = "idle";
                this.clearTTSHighlight();
                this.updateRibbonIcon();
            };

            generatingNotice.hide();
            await audio.play();
            this.audioState = "playing";
            this.updateRibbonIcon();
            this.startRAF(audio);
        } catch (error) {
            generatingNotice.hide();
            this.audioState = "idle";
            this.updateRibbonIcon();
            console.error("ElevenLabs: failed to generate or play audio.", error);
            new Notice("Eleven Labs: Failed to generate audio. Check your API key.", 5000);
        }
    }

    private startRAF(audio: HTMLAudioElement) {
        this.stopRAF();
        let lastWordIndex = -1;
        const tick = () => {
            if (!this.ttsEditorView || this.wordRanges.length === 0) {
                this.rafId = requestAnimationFrame(tick);
                return;
            }
            const t = audio.currentTime;
            // Binary search for the active word
            let lo = 0, hi = this.wordRanges.length - 1, idx = -1;
            while (lo <= hi) {
                const mid = (lo + hi) >>> 1;
                if (t < this.wordRanges[mid].startTime) {
                    hi = mid - 1;
                } else if (t >= this.wordRanges[mid].endTime) {
                    lo = mid + 1;
                } else {
                    idx = mid;
                    break;
                }
            }
            if (idx !== -1 && idx !== lastWordIndex) {
                lastWordIndex = idx;
                const w = this.wordRanges[idx];
                this.ttsEditorView.dispatch({
                    effects: setTTSHighlight.of({ from: w.from, to: w.to }),
                });
            }
            this.rafId = requestAnimationFrame(tick);
        };
        this.rafId = requestAnimationFrame(tick);
    }

    private stopRAF() {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    private buildWordRanges(alignment: Alignment, selFrom: number): WordRange[] {
        const { characters, character_start_times_seconds } = alignment;
        const words: WordRange[] = [];
        let wordStart = -1;

        for (let i = 0; i <= characters.length; i++) {
            const ch = characters[i];
            const isWordChar = ch !== undefined && /\S/.test(ch);

            if (isWordChar && wordStart === -1) {
                wordStart = i;
            } else if (!isWordChar && wordStart !== -1) {
                words.push({
                    from: selFrom + wordStart,
                    to: selFrom + i,
                    startTime: character_start_times_seconds[wordStart],
                    // Use next word's startTime as this word's endTime so there
                    // is no gap between words where nothing matches.
                    endTime: Infinity, // filled in below
                });
                wordStart = -1;
            }
        }

        // Patch endTimes: each word ends when the next word begins
        for (let i = 0; i < words.length - 1; i++) {
            words[i].endTime = words[i + 1].startTime;
        }
        if (words.length > 0) {
            words[words.length - 1].endTime = Infinity;
        }

        return words;
    }

    private clearTTSHighlight() {
        if (this.ttsEditorView) {
            this.ttsEditorView.dispatch({
                effects: setTTSHighlight.of(null),
            });
            this.ttsEditorView = null;
        }
    }

    private showElevenLabsMenu(e: MouseEvent) {
        const menu = new Menu();
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        const selectedText = markdownView?.editor.getSelection();

        if (selectedText || this.savedText) {
            menu.addItem((item) =>
                item.setTitle("Generate new audio").setIcon("audio-lines").onClick(() => this.handleGenerateNew())
            );
        }

        if (this.audioState === "playing" || this.audioState === "paused") {
            menu.addSeparator();
            if (this.audioState === "playing") {
                menu.addItem((item) =>
                    item.setTitle("Pause").setIcon("pause").onClick(() => this.handlePause())
                );
            } else {
                menu.addItem((item) =>
                    item.setTitle("Resume").setIcon("play").onClick(() => this.handleResume())
                );
            }
        }

        menu.showAtMouseEvent(e);
    }

    private updateRibbonIcon() {
        if (!this.ribbonIconEl) return;
        if (this.audioState === "loading") {
            setIcon(this.ribbonIconEl, "loader");
            this.ribbonIconEl.setAttribute("aria-label", "Generating audio...");
            this.ribbonIconEl.addClass("tts-ribbon-loading");
        } else if (this.audioState === "playing") {
            this.ribbonIconEl.removeClass("tts-ribbon-loading");
            setIcon(this.ribbonIconEl, "pause");
            this.ribbonIconEl.setAttribute("aria-label", "Pause TTS");
        } else if (this.audioState === "paused") {
            this.ribbonIconEl.removeClass("tts-ribbon-loading");
            setIcon(this.ribbonIconEl, "play");
            this.ribbonIconEl.setAttribute("aria-label", "Resume TTS");
        } else {
            this.ribbonIconEl.removeClass("tts-ribbon-loading");
            setIcon(this.ribbonIconEl, "audio-lines");
            this.ribbonIconEl.setAttribute("aria-label", "Read selected text aloud");
        }
    }

    async onload() {
        await this.loadSettings();

        // Load voices
        await this.loadVoices();

        // Load models
        await this.loadModels();

        // Register CM6 highlight decoration extension
        this.registerTTSEditorExtension();

        // Context menu — state-aware right-click trigger
        this.app.workspace.on("editor-menu", this.addContextMenuItems);

        // TTS command — available in command palette on all platforms, supports hotkey on desktop
        this.addCommand({
            id: "eleven-labs-tts-trigger",
            name: "Read aloud / Pause / Resume",
            checkCallback: (checking: boolean) => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                const hasSelection = !!view?.editor.getSelection() || !!this.savedText;
                const available =
                    (this.audioState === "playing" || this.audioState === "paused") ||
                    (this.audioState === "idle" && hasSelection);
                if (available && !checking) {
                    this.handleTTSTrigger();
                }
                return available;
            },
        });

        // Discrete toolbar commands — pin individual buttons to the mobile toolbar or assign hotkeys.
        this.addCommand({
            id: "eleven-labs-tts-generate",
            name: "Generate new audio",
            icon: "audio-lines",
            checkCallback: (checking: boolean) => {
                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                const hasSelection = !!view?.editor.getSelection() || !!this.savedText;
                const available = this.audioState !== "loading" && hasSelection;
                if (available && !checking) this.handleGenerateNew();
                return available;
            },
        });

        this.addCommand({
            id: "eleven-labs-tts-pause",
            name: "Pause reading",
            icon: "pause",
            checkCallback: (checking: boolean) => {
                const available = this.audioState === "playing";
                if (available && !checking) this.handlePause();
                return available;
            },
        });

        this.addCommand({
            id: "eleven-labs-tts-play",
            name: "Resume reading",
            icon: "play",
            checkCallback: (checking: boolean) => {
                const available = this.audioState === "paused";
                if (available && !checking) this.handleResume();
                return available;
            },
        });

        // Ribbon icon — left-click: pause/resume toggle; right-click: Eleven Labs menu.
        this.ribbonIconEl = this.addRibbonIcon(
            "audio-lines",
            "Read selected text aloud",
            () => { this.handleTTSTrigger(); }
        );
        this.ribbonIconEl.addEventListener("contextmenu", (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            this.showElevenLabsMenu(e);
        });

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new ElevenLabsSettingTab(this.app, this));
    }

    onunload() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.onended = null;
            this.currentAudio = null;
        }
        if (this.currentBlobUrl) {
            URL.revokeObjectURL(this.currentBlobUrl);
            this.currentBlobUrl = null;
        }
        this.stopRAF();
        this.clearTTSHighlight();
        this.wordRanges = [];
        this.savedText = "";
        this.savedCmEditor = null;
        this.audioState = "idle";
        this.app.workspace.off("editor-menu", this.addContextMenuItems);
    }

    async loadVoices() {
        try {
            const response = await ElevenLabsApi.getVoices(
                this.secrets.apiKey
            );
            this.voices = response.json.voices;
        } catch (error) {
            this.voices = [];
        }
    }

    async loadModels() {
        try {
            const response = await ElevenLabsApi.getModels(
                this.secrets.apiKey
            );
            this.models = response.json.filter(
                (m: any) => m.can_do_text_to_speech
            );
        } catch (error) {
            this.models = [];
        }
    }

    async loadSettings() {
        const saved = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
        this.secrets = Object.assign(
            {},
            DEFAULT_SECRETS,
            { apiKey: saved?.apiKey ?? "" }
        );
    }

    async saveSettings() {
        await this.saveData({
            ...this.settings,
            apiKey: this.secrets.apiKey,
        });
    }
}
