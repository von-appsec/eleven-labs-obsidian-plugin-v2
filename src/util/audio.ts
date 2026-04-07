import { Notice } from "obsidian";
import ElevenLabsApi from "src/eleven_labs_api";
import ElevenLabsPlugin from "main";

export interface Alignment {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
}

export interface AudioWithAlignment {
    audio: HTMLAudioElement;
    alignment: Alignment;
}

export async function generateAudioWithAlignment(
    plugin: ElevenLabsPlugin,
    text: string,
    voiceId: string,
    modelId: string,
): Promise<AudioWithAlignment | null> {
    try {
        const voiceSettingsEntry = plugin.settings.voiceSettings[voiceId];
        const options = voiceSettingsEntry?.enabled ? voiceSettingsEntry : undefined;

        const response = await ElevenLabsApi.textToSpeechWithTimestamps(
            plugin.secrets.apiKey,
            text,
            voiceId,
            modelId,
            options,
        );

        if (response.status !== 200) {
            console.error("ElevenLabs: TTS request failed with status:", response.status);
            new Notice("Eleven Labs: Failed to generate audio. Check your API key and settings.", 5000);
            return null;
        }

        const { audio_base64, alignment } = response.json;
        const binaryString = atob(audio_base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);

        return { audio, alignment };
    } catch (error) {
        console.error("ElevenLabs: failed to generate audio with alignment.");
        new Notice("Eleven Labs: Failed to generate audio. Check your API key.", 5000);
        return null;
    }
}

export async function generateAudio(
    plugin: ElevenLabsPlugin,
    text: string,
    voiceId: string,
    modelId: string,
) {

    try {
        new Notice("Eleven Labs: Generating audio...", 3000);

        const response = await ElevenLabsApi.textToSpeech(
            plugin.secrets.apiKey,
            text,
            voiceId,
            modelId,
        );

        if (response.status !== 200) {
            console.error("ElevenLabs: TTS request failed with status:", response.status);
            new Notice("Eleven Labs: Failed to generate audio. Check your API key and settings.", 5000);
            return;
        }

        // Play audio directly in memory — no file writes, works on mobile
        const blob = new Blob([response.arrayBuffer], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play();
 
    } catch (error) {
        console.error("ElevenLabs: failed to generate or play audio.");
        new Notice("Eleven Labs: Failed to generate audio. Check your API key.", 5000);
    }
}