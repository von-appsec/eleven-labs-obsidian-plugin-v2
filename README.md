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

- **T1**: API key stored in plaintext plugin settings (`data.json`)
- **T3**: audio output path traversal risk during vault writes
- **T8**: API key leakage risk via logs/console output

Risk tracking entries for these items are seeded in the same model file and are used to drive the release roadmap above.

## Security roadmap

- **v2.0.0**: fix the major risks identified in the threat model: **T1**, **T3**, and **T8**.
- **v2.1**: focus on remediating **elevated** risks.
- **v2.2**: focus on remediating **medium** risks.

## How to use

Once the plugin is installed, head to the plugin settings page in Obsidian and paste in your api key.

![Settings Api Key](/images/image9.png)

In your notes, when in **edit mode**, simply highlight the text you want to use, right click and select "Eleven Labs" from the context menu.

![Highlight text](/images/image2.png)

If you prefer, you can trigger the modal using the Command Palette (`CTRL` + `p`).

![Commmand Palette](/images/command-palette.png)

You'll then be presented with a modal, where you can select a voice to use from your Eleven Labs account:

![Modal](/images/image3.png)

Override the voice settings:

![Voice settings](/images/image4.png)

Select which model to use, allowing multilingual output:

![Model Select](/images/model-select.png)

Now you can generate your audio, by pressing the "Generate audio" button. This will happen in the background and can take a few minutes depending on the number of characters being processed. You will get a notification once the audio has been generated and downloaded to your vault.

![Generating notice](/images/image5.png)
![Audio file complete notice](/images/image6.png)
![File tree](/images/image7.png)
![Generated note](/images/image8.png)
