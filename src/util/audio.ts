import { Notice, MarkdownView } from "obsidian";
import ElevenLabsApi, { VoiceSettings } from "src/eleven_labs_api";
import ElevenLabsPlugin from "main";

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