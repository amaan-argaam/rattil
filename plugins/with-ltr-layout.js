// The mushaf draws its own right-to-left layout. Keep the Android view hierarchy left-to-right on every
// device locale so React Native does not mirror it a second time.
const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withLtrLayout(config) {
  return withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application?.[0];
    if (app) app.$["android:supportsRtl"] = "false";
    return c;
  });
};
