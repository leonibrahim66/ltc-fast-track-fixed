const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Block all Node.js built-ins that don't exist in React Native
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const nodeBuiltins = [
    "stream", "events", "http", "https", "zlib", "crypto",
    "buffer", "util", "path", "os", "fs", "net",
    "tls", "child_process", "cluster", "dgram", "dns",
    "domain", "querystring", "readline",
    "string_decoder", "timers", "tty", "vm", "worker_threads",
    "ws"
  ];

  if (nodeBuiltins.includes(moduleName)) {
    return { type: "empty" };
  }

  // Block whatwg-url as it conflicts with React Native's URL
  if (moduleName === "whatwg-url" || moduleName.startsWith("whatwg-url/")) {
    return { type: "empty" };
  }

  if (platform === "web" && moduleName === "react-native-maps") {
    return {
      filePath: path.resolve(__dirname, "lib/react-native-maps.web.tsx"),
      type: "sourceFile",
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});