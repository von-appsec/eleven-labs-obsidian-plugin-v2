# Eleven Labs text-to-speech Obsidian Plugin

This is a plugin for Obsidian (https://obsidian.md).

This project allows you to create text-to-speech audio files using the Eleven Labs api, straight from your Obsidian notes.

This requires an Eleven Labs (https://elevenlabs.io) account, and api key. You can retrieve your api key from "Profile Settings", when signed into the Eleven Labs web dashboard.

## Project background

This repository is a fork of the original 1.x project at https://github.com/veritas1/eleven-labs-obsidian-plugin.

The goal of this v2 project is to reduce the security risks of the original implementation while continuing with feature enhancements.

## Current threat model status

The current threat analysis [report](docs/report.pdf).

Custom risk categories are currently defined for:

- **T1**: API key stored in plaintext plugin settings — **accepted risk**
- **T3**: audio output path traversal risk during vault writes — **not present**
- **T8**: API key leakage risk via console.log output — **not present**

For detailed information see the [Threagile Report](./docs/report.pdf).

## Security roadmap

- **v2.0.0**: fix the major risks identified in the threat model: **T1**, **T3**, and **T8**.
- **v2.1**: focus on remediating **elevated** risks.
- **v2.2**: focus on remediating **medium** risks.

## How to use

### 1. Configure the plugin

Open **Settings → Community Plugins → Eleven Labs** and enter your API key. While the settings panel is open, select your preferred **Voice** and **Model** from the dropdowns — these are loaded from your ElevenLabs account.

### 2. Select text

In any note, switch to **edit mode** and highlight the text you want read aloud.

### 3. Trigger playback

Use any of the following entry points — they all share the same playback state:

- **Command palette** — open with `Ctrl/Cmd + P` and run `Read aloud / Pause / Resume`
- **Ribbon icon** — click the audio icon in the left sidebar (touch-friendly on mobile)
- **Right-click context menu** — select **Read aloud** from the editor context menu
- **Mobile toolbar** — pin individual play/pause/resume buttons to the Obsidian mobile toolbar (see [Mobile](#mobile) below)

### 4. In-editor highlight

While audio plays, the currently spoken word is highlighted directly in the editor. The highlight follows the audio position word-by-word and clears automatically when playback ends.

### 5. Pause and resume

Trigger the same entry point again to **pause**, and again to **resume**:

| State | Command palette | Ribbon icon | Context menu | Mobile toolbar |
|-------|----------------|-------------|--------------|----------------|
| Idle (text selected) | Read aloud / Pause / Resume | Play | Read aloud | Read aloud |
| Playing | Read aloud / Pause / Resume | Pause | Pause | Pause reading |
| Paused | Read aloud / Pause / Resume | Resume | Resume | Resume reading |

## Mobile

The plugin is fully compatible with Obsidian for iOS and Android.

### Mobile toolbar

Three discrete commands can be pinned to the Obsidian mobile toolbar for one-tap access:

| Command | Icon | Active when |
|---------|------|-------------|
| **Read aloud** | waveform | idle + text selected |
| **Pause reading** | pause | audio is playing |
| **Resume reading** | play | audio is paused |

To add them: **Settings → Mobile → Toolbar → search "Eleven Labs"** and tap each command to add it.

### Android selection handling

On Android, tapping the ribbon or a toolbar button dismisses the virtual keyboard before the callback fires, which can clear the active text selection. The plugin automatically saves the last non-empty selection in the editor and falls back to it, so playback starts correctly even after the keyboard is dismissed.

### Loading notice

A "Generating audio…" notice is displayed while the ElevenLabs API call is in-flight. On mobile, this notice stays visible for the full duration of the request and disappears automatically the moment playback begins.
