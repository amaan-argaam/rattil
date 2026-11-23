// Signs release builds with the keystore named by environment variables, so the keystore itself never
// lives in the repository. CI decodes it from a GitHub secret; locally, export the same variables.
//   RATTIL_KEYSTORE           path to the .jks file
//   RATTIL_KEYSTORE_PASSWORD  store password
//   RATTIL_KEY_ALIAS          key alias
//   RATTIL_KEY_PASSWORD       key password
// Without RATTIL_KEYSTORE, release builds fall back to the debug key (fine for local testing only).
const { withAppBuildGradle } = require("@expo/config-plugins");

const RELEASE = `
        release {
            if (System.getenv("RATTIL_KEYSTORE")) {
                storeFile file(System.getenv("RATTIL_KEYSTORE"))
                storePassword System.getenv("RATTIL_KEYSTORE_PASSWORD")
                keyAlias System.getenv("RATTIL_KEY_ALIAS")
                keyPassword System.getenv("RATTIL_KEY_PASSWORD")
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (c) => {
    let g = c.modResults.contents;
    if (!g.includes("RATTIL_KEYSTORE")) {
      g = g.replace(/signingConfigs \{\n(\s+)debug \{/, (m) => m.replace("signingConfigs {", "signingConfigs {" + RELEASE));
      // Only the release build type, which comes after `buildTypes {` (the signingConfigs block above also has a
      // `release {`, and the debug build type must keep the debug key).
      const at = g.indexOf("buildTypes {");
      const rel = at < 0 ? -1 : g.indexOf("release {", at);
      const sc = rel < 0 ? -1 : g.indexOf("signingConfig signingConfigs.debug", rel);
      if (sc >= 0)
        g = g.slice(0, sc) + 'signingConfig System.getenv("RATTIL_KEYSTORE") ? signingConfigs.release : signingConfigs.debug' + g.slice(sc + "signingConfig signingConfigs.debug".length);
      if (!g.includes('signingConfigs.release : signingConfigs.debug')) throw new Error("with-release-signing: build.gradle layout changed");
    }
    c.modResults.contents = g;
    return c;
  });
};
