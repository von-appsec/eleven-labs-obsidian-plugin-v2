# Changelog

## 2.3.0 (2026-04-03)


### Features

* add discrete mobile toolbar commands: "Read aloud" (`audio-lines`), "Pause reading" (`pause`), "Resume reading" (`play`) — each pinnable to the Obsidian mobile toolbar independently
* persist last CM6 selection via `ViewPlugin` so ribbon and toolbar commands work on Android after virtual keyboard dismisses
* pin "Generating audio..." `Notice` for the full duration of the API call (timeout=0); hide explicitly before playback begins and on all error paths


### Bug Fixes

* toolbar commands use `checkCallback` so they only appear active when the corresponding audio state is reachable
* `onunload` clears saved selection state to prevent stale Android fallback references


---

## 2.2.0 (2026-04-03)


### Features

* switch TTS trigger to `textToSpeechWithTimestamps` endpoint for word-by-word synchronized highlighting
* add `requestAnimationFrame`-based highlight loop replacing `ontimeupdate` for frame-rate word tracking
* add binary search over word ranges per RAF tick for O(log n) highlight dispatch
* add `"loading"` audio state with spinning ribbon icon (`loader` + `tts-ribbon-loading` CSS class) during API call
* persist effective model ID immediately on Settings display to fix silent null `selectedModelId`
* import and apply `DEFAULT_MODEL_ID` as fallback in `handleTTSTrigger` so model null never blocks playback


### Bug Fixes

* word `endTime` now set to next word's `startTime` eliminating inter-word highlight gaps
* reset state and ribbon icon to idle on API error or non-200 response
* `"loading"` state excluded from command palette availability check to prevent re-entrancy
* `stopRAF()` called on `onended` and `onunload` to cancel animation frame loop on cleanup


### Security / Threat Model

* T1 risk tracking updated to `accepted` — platform constraint, compensating notice already shown in Settings
* T3 risk tracking updated to `false-positive` — vault write code is dead; audio plays from Blob URL in memory
* T8 risk tracking updated to `false-positive` — no `console.log` calls; no secrets in any log output
* Regenerated all threat model outputs: `report.pdf`, `risks.json`, `risks.xlsx`, `stats.json`, `tags.xlsx`, `technical-assets.json`, `data-flow-diagram.png`, `data-asset-diagram.png`
* Updated README with per-risk findings and final status for T1, T3, T8


## 2.1.0 (2026-04-03)


### Features

* add CM6 StateField mark decoration for in-editor TTS highlight ([src/tts-highlight.ts](src/tts-highlight.ts))
* add `handleTTSTrigger()` shared play/pause/resume handler on plugin class
* register TTS command in command palette on all platforms with optional hotkey binding
* add ribbon icon with dynamic icon/label reflecting idle/playing/paused audio state
* manage `currentAudio` (HTMLAudioElement) and `audioState` at plugin level for cross-invocation state
* revoke Blob URL and clear decoration automatically on natural playback end


## 1.0.0 (2026-03-07)


### Features

* model select ([df5a733](https://github.com/vstrickl/eleven-labs-obsidian-plugin-v2/commit/df5a7331f22eb57aefcbb6f6a01b0f266579d0f2))
* open modal through command palette ([13c67ef](https://github.com/vstrickl/eleven-labs-obsidian-plugin-v2/commit/13c67ef5b0229e73bed35230b63f37b88317cc8e))


### Bug Fixes

* css affecting core styling ([a276da0](https://github.com/vstrickl/eleven-labs-obsidian-plugin-v2/commit/a276da0b053ef4bb576a399c62f5a1434115dc12))
* modal padding on global css selector ([28ec604](https://github.com/vstrickl/eleven-labs-obsidian-plugin-v2/commit/28ec604e2d5a6ab5ca8bdff01539385eefa2c575))
* not unloading event ([967dc18](https://github.com/vstrickl/eleven-labs-obsidian-plugin-v2/commit/967dc18c9760c1960528b50e4df4c22bfa7d9144))
* replace innerHTML with .empty() ([d0070ff](https://github.com/vstrickl/eleven-labs-obsidian-plugin-v2/commit/d0070ff1e8208eeb7661699bc1573fab287968b4))
* use requestUrl instead of axios ([ae04ed5](https://github.com/vstrickl/eleven-labs-obsidian-plugin-v2/commit/ae04ed5b85a242250a23d905521898bdd975739f))
* use sentence case in UI ([58f53f9](https://github.com/vstrickl/eleven-labs-obsidian-plugin-v2/commit/58f53f980da9828e2c820ad2c2ac79c2ac75e9cb))
