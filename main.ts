import {
    Editor,
    MarkdownView,
    Plugin,
    Menu,
    MarkdownFileInfo,
} from "obsidian";
import {
    ElevenLabsPluginSettings,
    DEFAULT_SETTINGS,
    ElevenLabsSettingTab,
    ElevenLabsSecrets,
    DEFAULT_SECRETS,
} from "./src/settings";
import ElevenLabsApi from "./src/eleven_labs_api";
import { ElevenLabsModal } from "./src/modals";

export default class ElevenLabsPlugin extends Plugin {
    settings: ElevenLabsPluginSettings;
    secrets: ElevenLabsSecrets;
    voices: any[];
    models: any[];

    addContextMenuItems = (
        menu: Menu,
        editor: Editor,
        info: MarkdownView | MarkdownFileInfo
    ) => {
        menu.addItem((item) => {
            const markdownView =
                this.app.workspace.getActiveViewOfType(MarkdownView);
            const selectedText = markdownView?.editor.getSelection();

            item.setTitle("Eleven Labs")
                .setIcon("file-audio")
                .onClick(async () => {
                    if (selectedText != null) {
                        new ElevenLabsModal(this, selectedText).open();
                    }
                });

            item.setDisabled(selectedText == null); // Disable the item if no text is selected
        });
    };

    openModalCommand = {
        id: "eleven-labs-open-modal",
        name: "Open Modal",
        editorCheckCallback: (
            checking: boolean,
            editor: Editor,
            view: MarkdownView
        ) => {
            const selectedText = view?.editor.getSelection();
            if (selectedText) {
                if (!checking) {
                    new ElevenLabsModal(this, selectedText).open();
                }
                return true;
            }
            return false;
        },
    };

    async onload() {
        await this.loadSettings();

        // Load voices
        await this.loadVoices();

        // Load models
        await this.loadModels();

        // Add context menu item
        this.app.workspace.on("editor-menu", this.addContextMenuItems);

        // Add command to open modal
        this.addCommand(this.openModalCommand);

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new ElevenLabsSettingTab(this.app, this));
    }

    onunload() {
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
