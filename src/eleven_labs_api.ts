import { requestUrl } from "obsidian";

export const BASE_URL = "https://api.elevenlabs.io/v1";
export const WSS_URL = "wss://api.elevenlabs.io/v1";

export interface VoiceSettings {
    stability: number;
    similarity_boost: number;
}

interface TextToSpeechRequest {
    model_id: string;
    text: string;
    voice_settings?: VoiceSettings;
}

class ElevenLabsApi {
    static async getVoices(apiKey: string) {
        return requestUrl({
            url: `${BASE_URL}/voices`,
            method: "GET",
            headers: {
                "xi-api-key": apiKey,
            },
        });
    }

    static async getModels(apiKey: string) {
        return requestUrl({
            url: `${BASE_URL}/models`,
            method: "GET",
            headers: {
                "xi-api-key": apiKey,
            },
        });
    }

    static async textToSpeech(
        apiKey: string,
        text: string,
        voiceId: string,
        modelId: string,
        options?: VoiceSettings
    ) {
        const data: TextToSpeechRequest = {
            model_id: modelId,
            text: text,
        };
        if (options) {
            const settings: VoiceSettings = {
                stability: options.stability / 100.0,
                similarity_boost: options.similarity_boost / 100.0,
            };
            data.voice_settings = settings;
        }

        const requestBody = JSON.stringify(data);
        const requestUrlValue = `${BASE_URL}/text-to-speech/${voiceId}`;

        try {
            const response = await requestUrl({
                url: requestUrlValue,
                method: "POST",
                contentType: "application/json",
                headers: {
                    "Accept": "audio/mpeg",
                    "xi-api-key": apiKey,
                },
                body: requestBody,
            });

            return response;
        } catch (error) {
            console.error("[ElevenLabsApi.textToSpeech] Request failed");
            throw error;
        }
    }

    static async textToSpeechWithTimestamps(
        apiKey: string,
        text: string,
        voiceId: string,
        modelId: string,
        options?: VoiceSettings
    ) {
        const data: TextToSpeechRequest = {
            model_id: modelId,
            text: text,
        };
        if (options) {
            const settings: VoiceSettings = {
                stability: options.stability / 100.0,
                similarity_boost: options.similarity_boost / 100.0,
            };
            data.voice_settings = settings;
        }

        try {
            return await requestUrl({
                url: `${BASE_URL}/text-to-speech/${voiceId}/with-timestamps`,
                method: "POST",
                contentType: "application/json",
                headers: {
                    "Accept": "application/json",
                    "xi-api-key": apiKey,
                },
                body: JSON.stringify(data),
            });
        } catch (error) {
            console.error("[ElevenLabsApi.textToSpeechWithTimestamps] Request failed");
            throw error;
        }
    }
}

export default ElevenLabsApi;
