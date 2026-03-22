# Changelog

## [1.0.1](https://github.com/von-appsec/eleven-labs-obsidian-plugin-v2/compare/v1.0.0...v1.0.1) (2026-03-22)


### Bug Fixes

* **api:** remove debug console.log calls and clean up request headers ([d5fbe6f](https://github.com/von-appsec/eleven-labs-obsidian-plugin-v2/commit/d5fbe6fdc11f07e62968ff34ff7fd06f0df0fe17))
* **audio:** play TTS output in-memory via Blob/Audio instead of writing to vault ([cdf1193](https://github.com/von-appsec/eleven-labs-obsidian-plugin-v2/commit/cdf1193e4b726728a9588b84669b35b1c92c0797))
* **plugin:** await voice/model loading and guard empty arrays on startup ([4d528d2](https://github.com/von-appsec/eleven-labs-obsidian-plugin-v2/commit/4d528d22ff4380a2650a0b62eddf47c8666a59f9))
* **ui:** guard against missing model/voice data and refresh on modal open ([72fb102](https://github.com/von-appsec/eleven-labs-obsidian-plugin-v2/commit/72fb1022a3e36b8f588100c196d1cf271d13bc81))

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
