# Notices

Rattil's own code is licensed under the GNU General Public License v3.0 or later (`LICENSE`). It bundles or
downloads the works below, each under its own terms.

## Speech recognition: Tilawa

- **@tilawa/core** (https://github.com/yazinsai/tilawa), © yazinsai, **MIT**. The on-device recitation engine.
- **Tilawa listener models** `spliced-clean-lite@1-int8` and `spliced-clean@1-int8`, released by Tilawa
  (tilawa.dev) under **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/). They are not bundled in the
  APK: the app downloads them once from Tilawa's official asset host, `https://tilawa.dev/v1/`, and checks each
  file against the size and sha256 pinned in the SDK's model registry. Credit, as asked by the model card:
  "Tilawa (tilawa.dev)" and its sources:
  - tlog (`tarteel-ai/tlog`) by Tarteel, CC-BY: training and evaluation audio.
  - Quranic Universal Ayahs and the QUD alignment benchmark by QUD Technologies, CC-BY.
  - muaalem (`obadx/muaalem-model-v3_2`), MIT: the teacher model and phoneme inventory.
  - quran-transcript (`obadx/quran-transcript`), MIT: phonemization of the reference.
  - k2-fsa icefall, Apache-2.0: streaming Zipformer architecture, recipe and export.
  - Tanzil: the Quran text the reference is derived from.
  Full notices: https://github.com/yazinsai/tilawa/blob/main/NOTICE.md
- The Quran reference `ref-v2.json` is downloaded the same way.

Note: Tilawa's NOTICE.md lists NPL-1.2 (non-commercial, share-alike) terms for its **0.x** models. Rattil uses
only the 1.x models, which are CC BY 4.0. Rattil is non-commercial and share-alike (GPL) anyway: it is free, has
no ads and no paid features.

## Quran text: Tanzil

`src/data/generated/quran-text.json` is a verbatim copy of the **Tanzil Quran Text (Uthmani, Version 1.1)**,
© 2007-2026 Tanzil Project, **Creative Commons Attribution 3.0**. The text is not changed; Tanzil's full notice is
kept inside that file and shown in the app's About screen. Source and updates: https://tanzil.net.
Surah names and the page, juz and hizb boundaries in `meta.json` come from Tanzil's metadata (`quran-data.js`).

## Page layout: DigitalKhatt

The line breaks in `src/data/generated/layout.json` (15 lines per page, 604 pages, Madina mushaf) come from
`quran_text_old_madinah.ts` in **digitalkhatt-js** (https://github.com/DigitalKhatt/digitalkhatt-js, commit
78372d7), © 2020–present DigitalKhatt contributors, **MIT**. Only the positions of the line breaks are used;
every word displayed is Tanzil's. The build script checks every line break against the ayah numbers in the
DigitalKhatt data and every page start against Tanzil's page table.

## Fonts

`assets/fonts/AmiriQuran.ttf`, `Amiri-Regular.ttf`, `Amiri-Bold.ttf`: **Amiri 1.003**, © 2010-2022 The Amiri
Project Authors (https://github.com/aliftype/amiri), **SIL Open Font License 1.1** (`assets/fonts/OFL-Amiri.txt`).

## Libraries

React Native and Expo (MIT), ONNX Runtime Web / onnxruntime-web 1.30.0 (Microsoft, MIT; its WASM binary is
bundled in the APK), react-native-webview (MIT), react-native-audio-api
(Software Mansion, MIT), react-native-svg (MIT), react-native-pager-view (MIT), react-native-safe-area-context
(MIT), HarfBuzz / harfbuzzjs (MIT, build-time only, to measure line widths), esbuild (MIT, build-time only).
