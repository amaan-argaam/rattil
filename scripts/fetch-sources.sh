#!/usr/bin/env bash
# Downloads the upstream sources the Quran data is generated from into data-src/ (git-ignored).
# Run scripts/build-quran-data.mjs afterwards.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data-src
# Tanzil Uthmani text v1.1 (CC BY 3.0, verbatim). Options: pause marks, sajdah and rub-el-hizb signs,
# superscript alef and tatweel exactly as Tanzil ships them.
curl -fsSL -o data-src/quran-uthmani.txt \
  "https://tanzil.net/pub/download/index.php?marks=true&sajdah=true&rub=true&alef=true&tatweel=true&quranType=uthmani&outType=txt-2&agree=true"
# Tanzil metadata (surah names, page/juz/hizb boundaries of the 604-page Madani mushaf).
curl -fsSL -o data-src/quran-data.js "https://tanzil.net/res/text/metadata/quran-data.js"
# DigitalKhatt (MIT): the 15-line line breaks of the 604-page Madina mushaf (1405H print). Only line breaks are taken from it.
DK_COMMIT=78372d7a1e211bbab677cc0304384f278f508657
curl -fsSL -o data-src/quran_text_old_madinah.ts \
  "https://raw.githubusercontent.com/DigitalKhatt/digitalkhatt-js/${DK_COMMIT}/apps/site-angular/src/app/services/quran_text_old_madinah.ts"
echo "sources in data-src/"
