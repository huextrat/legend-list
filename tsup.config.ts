import { defineConfig } from "tsup";

const external = [
    "react",
    "react-native",
    "react-native-keyboard-controller",
    "react-native-reanimated",
    "@legendapp/list",
    "@legendapp/list/animated",
    "@legendapp/list/reanimated",
];

export default defineConfig({
    entry: ["src/index.ts", "src/integrations/animated.tsx", "src/integrations/reanimated.tsx", "src/integrations/keyboard-controller.tsx"],
    format: ["cjs", "esm"],
    external,
    dts: true,
    treeshake: true,
    splitting: false,
    clean: true,
});
