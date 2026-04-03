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

Use any of the three entry points — they all share the same playback state:

- **Command palette** — open with `Ctrl/Cmd + P` and run `Read aloud / Pause / Resume`
- **Ribbon icon** — click the audio icon in the left sidebar (touch-friendly on mobile)
- **Right-click context menu** — select **Read aloud** from the editor context menu

### 4. In-editor highlight

While audio plays, the selected text is highlighted directly in the editor. The highlight persists through pause and clears automatically when playback ends.

### 5. Pause and resume

Trigger the same entry point again to **pause**, and again to **resume**:

| State | Command palette | Ribbon icon | Context menu |
|-------|----------------|-------------|--------------|
| Idle (text selected) | Read aloud | Play | Read aloud |
| Playing | Pause | Pause | Pause |
| Paused | Resume | Resume | Resume |
