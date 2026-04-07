import ElevenLabsPlugin from "main";
import {
    ButtonComponent,
    DropdownComponent,
    SliderComponent,
    TextAreaComponent,
    ToggleComponent,
} from "obsidian";
import { VoiceSettings, DEFAULT_MODEL_ID } from "src/settings";
import { Alignment } from "src/util/audio";

interface WordTimestamp {
    word: string;
    start: number;
    end: number;
}

function buildWordTimestamps(alignment: Alignment): WordTimestamp[] {
    const words: WordTimestamp[] = [];
    let currentWord = "";
    let wordStart = 0;
    let wordEnd = 0;

    for (let i = 0; i < alignment.characters.length; i++) {
        const char = alignment.characters[i];
        const start = alignment.character_start_times_seconds[i];
        const end = alignment.character_end_times_seconds[i];

        if (char === " " || char === "\n" || char === "\t") {
            if (currentWord.length > 0) {
                words.push({ word: currentWord, start: wordStart, end: wordEnd });
                currentWord = "";
            }
        } else {
            if (currentWord.length === 0) wordStart = start;
            currentWord += char;
            wordEnd = end;
        }
    }

    if (currentWord.length > 0) {
        words.push({ word: currentWord, start: wordStart, end: wordEnd });
    }
    return words;
}

export function renderGenerateAudioButton(
    parent: HTMLElement,
    callback: () => void | Promise<void>
): ButtonComponent {
    return new ButtonComponent(parent)
        .setClass("btn-generate-audio")
        .setButtonText("Generate audio")
        .onClick(callback);
}

export function showHighlightedText(
    container: HTMLElement,
    selectedText: string,
    alignment: Alignment,
    audio: HTMLAudioElement
): void {
    container.empty();
    container.createEl("h6", { text: "Text" });

    const textDisplay = container.createDiv("highlighted-text");
    const wordTimestamps = buildWordTimestamps(alignment);
    let textIndex = 0;
    const wordSpans: HTMLElement[] = [];

    for (const wt of wordTimestamps) {
        const idx = selectedText.indexOf(wt.word, textIndex);
        if (idx === -1) continue;

        if (idx > textIndex) {
            textDisplay.appendText(selectedText.slice(textIndex, idx));
        }

        const span = textDisplay.createEl("span", { text: wt.word, cls: "highlight-word" });
        span.dataset.start = String(wt.start);
        span.dataset.end = String(wt.end);
        wordSpans.push(span);
        textIndex = idx + wt.word.length;
    }

    if (textIndex < selectedText.length) {
        textDisplay.appendText(selectedText.slice(textIndex));
    }

    container.createDiv("char-count").setText(`Characters: ${selectedText.length}`);

    audio.addEventListener("timeupdate", () => {
        const currentTime = audio.currentTime;
        wordSpans.forEach(span => {
            const start = parseFloat(span.dataset.start ?? "0");
            const end = parseFloat(span.dataset.end ?? "0");
            if (currentTime >= start && currentTime < end) {
                span.addClass("active");
            } else {
                span.removeClass("active");
            }
        });
    });

    audio.addEventListener("ended", () => {
        wordSpans.forEach(span => span.removeClass("active"));
    });
}

export function renderPlaybackControls(
    parent: HTMLElement,
    audio: HTMLAudioElement
): void {
    const container = parent.createDiv("playback-controls");

    const playPauseBtn = new ButtonComponent(container)
        .setClass("playback-btn");

    const updateBtn = () => {
        playPauseBtn.setButtonText(audio.paused ? "▶  Play" : "⏸  Pause");
    };
    updateBtn();

    playPauseBtn.onClick(() => {
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
    });

    audio.addEventListener("play", updateBtn);
    audio.addEventListener("pause", updateBtn);
    audio.addEventListener("ended", updateBtn);

    const progressBar = container.createEl("input", { cls: "playback-progress" }) as HTMLInputElement;
    progressBar.type = "range";
    progressBar.min = "0";
    progressBar.max = "100";
    progressBar.value = "0";
    progressBar.step = "0.1";

    const timeLabel = container.createDiv("time-label");
    timeLabel.setText("0:00 / 0:00");

    const formatTime = (seconds: number): string => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    };

    const updateProgress = () => {
        if (audio.duration) {
            progressBar.value = String((audio.currentTime / audio.duration) * 100);
            timeLabel.setText(`${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`);
        }
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", updateProgress);

    progressBar.addEventListener("input", () => {
        if (audio.duration) {
            audio.currentTime = (parseFloat(progressBar.value) / 100) * audio.duration;
        }
    });
}

export function renderModelLanguageChips(
    plugin: ElevenLabsPlugin,
    parent: HTMLElement,
) {
    parent.empty();
    const models: any[] = plugin.models;
    const selectedModelId: string = plugin.settings.selectedModelId || DEFAULT_MODEL_ID;
    const selectedModel = models.find(
        (model) => model.model_id === selectedModelId
    );
    if (!selectedModel) return;
    const languages: string[] = selectedModel.languages.map((language: any): string => { return language.name });
    languages.forEach((language: string) => {
        parent.createEl("span", {
            text: language,
            cls: "language-chip",
        });
    });
}

export function renderVoiceSettings(
    plugin: ElevenLabsPlugin,
    parent: HTMLElement,
    onVoiceSelected: () => void
) {
    const voices = plugin.voices ?? [];
    parent.empty();

    const selectedVoiceId = plugin.settings.selectedVoiceId || "";

    let voiceSettings: VoiceSettings =
        plugin.settings.voiceSettings[selectedVoiceId];
    if (voiceSettings == undefined) {
        voiceSettings = {
            enabled: false,
            stability: 0,
            similarity_boost: 0,
        };
        plugin.settings.voiceSettings[selectedVoiceId] = voiceSettings;
    }

    parent.createEl("h6", { text: "Voice settings" });
    const voiceSettingsToggle = new ToggleComponent(parent)
        .setValue(voiceSettings.enabled)
        .setTooltip("Enable voice settings")
        .onChange((value) => {
            voiceSettingsContainer.toggle(value);
            plugin.settings.voiceSettings[selectedVoiceId]["enabled"] = value;
        });
    const voiceSettingsContainer = parent.createDiv("voice-settings-container");
    voiceSettingsContainer.createDiv({
        cls: "voice-settings-description",
        text: "These settings will override the stored settings for this voice. They only apply to this audio file.",
    });

    voiceSettingsContainer.toggle(voiceSettings.enabled);

    const stabilityInitialValue =
        plugin.settings.voiceSettings[selectedVoiceId]["stability"] || 0;

    const stabilityEl = voiceSettingsContainer.createEl("div", {
        text: `Stability: ${stabilityInitialValue}`,
    });
    const stabilitySlider = new SliderComponent(voiceSettingsContainer)
        .setValue(stabilityInitialValue) // Sets initial value
        .setLimits(0, 100, 1) // Minimum, Maximum, Step
        .onChange((value) => {
            stabilityEl.setText(`Stability: ${value}`);
            plugin.settings.voiceSettings[selectedVoiceId]["stability"] = value;
        });

    const similarityBoostInitialValue =
        plugin.settings.voiceSettings[selectedVoiceId]["similarity_boost"] || 0;

    const similarityEl = voiceSettingsContainer.createEl("div", {
        text: `Similarity boost: ${similarityBoostInitialValue}`,
    });
    // Add a slider
    const similaritySlider = new SliderComponent(voiceSettingsContainer)
        .setValue(similarityBoostInitialValue) // Sets initial value
        .setLimits(0, 100, 1) // Minimum, Maximum, Step
        .onChange((value) => {
            similarityEl.setText(`Similarity boost: ${value}`);
            plugin.settings.voiceSettings[selectedVoiceId]["similarity_boost"] =
                value;
        });

    return {
        voiceSettingsToggle,
        stabilitySlider,
        similaritySlider,
    };
}

export function renderTextSection(parent: HTMLElement, selectedText: string): HTMLElement {
    const container = parent.createDiv("eleven-labs-text-area");
    container.createEl("h6", { text: "Text" });
    new TextAreaComponent(container)
        .setPlaceholder("Enter text here")
        .setValue(selectedText)
        .setDisabled(true);
    container.createDiv("char-count").setText(`Characters: ${selectedText.length}`);
    return container;
}

function addVoicesToOptionGroup(
    voices: any[],
    optgroupEl: HTMLElement,
    selectedVoiceId: string
) {
    voices.forEach((voice) => {
        const optionEl = optgroupEl.createEl("option", {
            text: voice.name,
            value: voice.voice_id,
        });
        // Check if this option was the previously selected option
        if (voice.voice_id === selectedVoiceId) {
            optionEl.setAttribute("selected", "selected");
        }
    });
}

function addCategory(
    selectEl: HTMLElement,
    label: string,
    voices: any[] | undefined,
    selectedVoiceId: string
) {
    if (voices) {
        const optgroupEl = selectEl.createEl("optgroup");
        optgroupEl.label = label;
        addVoicesToOptionGroup(voices, optgroupEl, selectedVoiceId);
    }
}

function voicesGroupedByCategory(voices: any[]) {
    return voices.reduce((acc, voice) => {
        // If the category hasn't been seen before, create an empty array for it
        if (!acc.has(voice.category)) {
            acc.set(voice.category, []);
        }

        // Push the current voice to its category array
        acc.get(voice.category).push(voice);

        return acc;
    }, new Map());
}

export function renderVoiceSelect(
    plugin: ElevenLabsPlugin,
    parent: HTMLElement,
    onVoiceSelected: () => void
): HTMLSelectElement {
    const voices: any[] = plugin.voices ?? [];
    const selectedVoiceId: string = plugin.settings.selectedVoiceId || "";
    return parent.createEl("select", "dropdown", (selectEl) => {
        // Add default prompt option
        const defaultOptionEl = selectEl.createEl("option", {
            text: "Select a voice",
        });
        defaultOptionEl.setAttribute("selected", "selected");
        defaultOptionEl.setAttribute("disabled", "disabled");

        if (voices.length === 0) {
            const noVoicesOptionEl = selectEl.createEl("option", {
                text: "No voices found (check API key)",
            });
            noVoicesOptionEl.setAttribute("disabled", "disabled");
            return;
        }

        // Add voices to dropdown (grouped by category)
        const groupedByCategory: Map<string, any[]> =
            voicesGroupedByCategory(voices);

        groupedByCategory.forEach((categoryVoices, categoryName) => {
            const label =
                categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
            addCategory(selectEl, label, categoryVoices, selectedVoiceId);
        });

        selectEl.addEventListener("change", (_) => {
            const selectedOption = selectEl.value;
            plugin.settings.selectedVoiceId = selectedOption;
            plugin.saveSettings();
            onVoiceSelected();
        });
    });
}

export function renderModelSelect(
    plugin: ElevenLabsPlugin,
    parent: HTMLElement,
    onModelSelected: () => void
): HTMLSelectElement {
    const models: any[] = plugin.models;
    const selectedModelId: string = plugin.settings.selectedModelId || "";

    const options: Record<string, string> = models.reduce((acc, obj) => {
        acc[obj.model_id] = obj.name;
        return acc;
    }, {} as Record<string, string>);

    const dropdown = new DropdownComponent(parent)
        .addOptions(options)
        .setValue(selectedModelId || DEFAULT_MODEL_ID)
        .onChange((value) => {
            plugin.settings.selectedModelId = value;
            plugin.saveSettings();
            onModelSelected();
        });

    dropdown.selectEl.classList.add("eleven-labs-model-select");

    return dropdown.selectEl;
}
