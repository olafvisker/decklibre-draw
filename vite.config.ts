import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [tsconfigPaths(), dts()],
  build: {
    lib: {
      entry: "src/index.ts",
      name: "DecklibreDraw",
      fileName: "decklibre-draw",
      formats: ["es", "cjs", "umd"],
    },
    rollupOptions: {
      external: ["@deck.gl/core", "maplibre-gl", "uuid", "@turf/turf"],
      output: {
        globals: {
          "@deck.gl/core": "Deck",
          "maplibre-gl": "maplibregl",
          uuid: "uuid",
          "@turf/turf": "turf",
        },
      },
    },
  },
});
