import { App, PluginSettingTab, Setting } from "obsidian";
import ElevenLabsPlugin from "../main";

export const DEFAULT_MODEL_ID = "eleven_monolingual_v1";

export interface VoiceSettings {
    enabled: boolean;
    stability: number;
    similarity_boost: number;
}

export interface ElevenLabsSecrets {
    apiKey: string;
}

export interface ElevenLabsPluginSettings {
    selectedVoiceId: string | null;
    selectedModelId: string | null;
    voiceSettings: { [key: string]: VoiceSettings };
}

export const DEFAULT_SETTINGS: ElevenLabsPluginSettings = {
    selectedVoiceId: null,
    selectedModelId: null,
    voiceSettings: {},
};

export const DEFAULT_SECRETS: ElevenLabsSecrets = {
    apiKey: "",
};

export class ElevenLabsSettingTab extends PluginSettingTab {
    plugin: ElevenLabsPlugin;

    constructor(app: App, plugin: ElevenLabsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName("⚠️ Security notice")
            .setDesc(
                "Your API key is stored in your vault's plugin data (data.json) " +
                "as plain text. Do not sync this vault to a public repository " +
                "or unencrypted cloud storage. Treat this key like a password."
            );

        // Make the API key input a password field
        new Setting(containerEl)
            .setName("API key")
            .setDesc("Your ElevenLabs API key from Profile Settings.")
            .addText((text) => {
                text.inputEl.type = "password";   // ← masks the key in UI
                text
                    .setPlaceholder("sk-...")
                    .setValue(this.plugin.secrets.apiKey)
                    .onChange(async (value) => {
                        this.plugin.secrets.apiKey = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("Voice")
            .setDesc("The voice used for text-to-speech.")
            .addDropdown((dropdown) => {
                const voices = this.plugin.voices ?? [];
                if (voices.length === 0) {
                    dropdown.addOption("", "No voices found — check API key");
                } else {
                    dropdown.addOption("", "Select a voice");
                    voices.forEach((voice) => dropdown.addOption(voice.voice_id, voice.name));
                }
                dropdown.setValue(this.plugin.settings.selectedVoiceId ?? "");
                dropdown.onChange(async (value) => {
                    this.plugin.settings.selectedVoiceId = value || null;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName("Model")
            .setDesc("The ElevenLabs model used for text-to-speech.")
            .addDropdown((dropdown) => {
                const models = this.plugin.models ?? [];
                if (models.length === 0) {
                    dropdown.addOption("", "No models found — check API key");
                } else {
                    models.forEach((model) => dropdown.addOption(model.model_id, model.name));
                }

                // Resolve the effective model: use saved value, fall back to default,
                // then fall back to first available. Persist immediately so the stored
                // value always matches what the dropdown displays.
                const savedModel = this.plugin.settings.selectedModelId;
                const effectiveModel =
                    savedModel ??
                    (models.some((m) => m.model_id === DEFAULT_MODEL_ID)
                        ? DEFAULT_MODEL_ID
                        : models[0]?.model_id ?? "");
                dropdown.setValue(effectiveModel);
                if (!savedModel && effectiveModel) {
                    this.plugin.settings.selectedModelId = effectiveModel;
                    this.plugin.saveSettings();
                }

                dropdown.onChange(async (value) => {
                    this.plugin.settings.selectedModelId = value || null;
                    await this.plugin.saveSettings();
                });
            });
    }
}
