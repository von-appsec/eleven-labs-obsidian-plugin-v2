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
import { EditorView } from "@codemirror/view";
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

    addContextMenuItems = (
        menu: Menu,
        _editor: Editor,
        _info: MarkdownView | MarkdownFileInfo
    ) => {
        if (this.audioState === "playing") {
            menu.addItem((item) =>
                item.setTitle("Pause").setIcon("pause").onClick(() => this.handleTTSTrigger())
            );
        } else if (this.audioState === "paused") {
            menu.addItem((item) =>
                item.setTitle("Resume").setIcon("play").onClick(() => this.handleTTSTrigger())
            );
        } else {
            const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
            const selectedText = markdownView?.editor.getSelection();
            if (selectedText) {
                menu.addItem((item) =>
                    item.setTitle("Read aloud").setIcon("audio-lines").onClick(() => this.handleTTSTrigger())
                );
            }
        }
    };

    registerTTSEditorExtension() {
        this.registerEditorExtension(ttsHighlightField);
    }

    async handleTTSTrigger() {
        if (this.audioState === "playing") {
            this.currentAudio!.pause();
            this.audioState = "paused";
            this.updateRibbonIcon();
            return;
        }

        if (this.audioState === "paused") {
            await this.currentAudio!.play();
            this.audioState = "playing";
            this.updateRibbonIcon();
            return;
        }

        // idle — require selected text and configured voice/model
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!markdownView) {
            new Notice("Eleven Labs: Open a note and select text to read aloud.", 3000);
            return;
        }

        const selectedText = markdownView.editor.getSelection();
        if (!selectedText) return;

        const voiceId = this.settings.selectedVoiceId;
        const modelId = this.settings.selectedModelId ?? DEFAULT_MODEL_ID;
        if (!voiceId) {
            new Notice("Eleven Labs: Select a voice in Settings.", 5000);
            return;
        }

        // Capture the CM6 editor reference and selection start before the async
        // network call so the highlight is anchored even if focus moves.
        const cmEditor = (markdownView.editor as any)?.cm as EditorView | undefined;
        const selFrom = cmEditor?.state.selection.main.from ?? 0;

        // Show loading spinner on ribbon while the API call is in-flight
        this.audioState = "loading";
        this.updateRibbonIcon();

        try {
            new Notice("Eleven Labs: Generating audio...", 3000);

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

            // Build word-level ranges with timing from the character alignment data
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

            await audio.play();
            this.audioState = "playing";
            this.updateRibbonIcon();
            this.startRAF(audio);
        } catch (error) {
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
                const available =
                    (this.audioState === "playing" || this.audioState === "paused") ||
                    (this.audioState === "idle" && !!view?.editor.getSelection());
                if (available && !checking) {
                    this.handleTTSTrigger();
                }
                return available;
            },
        });

        // Ribbon icon — touch-accessible trigger for mobile
        this.ribbonIconEl = this.addRibbonIcon(
            "audio-lines",
            "Read selected text aloud",
            () => { this.handleTTSTrigger(); }
        );

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
