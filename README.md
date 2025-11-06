# decklibre-draw

<p style="text-align: center;">
  <span style="display: inline-block; border-radius: 4px; box-shadow: 0 8px 16px rgba(0,0,0,0.3); overflow: hidden;">
    <img src="assets/tool.gif" alt="Tool" style="display: block;">
  </span>
</p>

**decklibre-draw** is a small WIP library for drawing and editing geometries on Deck.gl and MapLibre GL. Loosely inspired by mapbox-gl-draw, shapes are defined by **feature generators**, allowing you to create arbitrary geometries and control them via independent handles. This approach separates the editable points from the shape itself, giving you flexible editing beyond more common vertex-based libraries.

- Draw and edit points, lines, polygons, circles and rectangles
- Custom feature generators allow creating new types of geometries
- Mode-based interactions for drawing, selecting, and direct editing
- Designed for Deck.gl and MapLibre GL with potential support for other renderers in the future

> Very much work in progress. API and features will change

### Example usage

```ts
import maplibregl from "maplibre-gl";
import { DrawController } from "./core/draw-controller";
import { SimpleSelect } from "./core/modes/simple-select-mode";
import { DrawCircleMode } from "./core/modes/draw-circle-mode";
import { Deck, GeoJsonLayer } from "deck.gl";

const map = new maplibregl.Map();
const deck = new Deck();
const controller = new DrawController(deck, map, {
  initialMode: new SimpleSelect(),
  onUpdate: (features) => console.log("Updated features", features),
});

controller.changeMode(new DrawLineStringMode());
```
