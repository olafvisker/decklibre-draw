import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
  ],
  optimizeDeps: {
    include: ["uuid", "@turf/turf"],
  },
  resolve: {
    alias: {
      "@decklibre-draw": path.resolve(__dirname, "../decklibre-draw/src"),
    },
  },
});
