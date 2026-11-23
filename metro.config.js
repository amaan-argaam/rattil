const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// onnxruntime-web's WASM binary ships as a plain asset (assets/engine/*.wasm.bin) for the engine WebView.
config.resolver.assetExts.push("bin");
module.exports = config;
