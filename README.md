# decklibre-draw

![Tool](assets/tool.gif)

**decklibre-draw** is a lightweight library for drawing and editing geometries on **Deck.gl** and **MapLibre GL**. Loosely inspired by `mapbox-gl-draw`, shapes are defined by **feature generators**, which separate editable points (handles) from the shapes themselves. This allows for flexible editing beyond standard vertex-based libraries.

- Draw and edit points, lines, polygons, circles, and rectangles
- Custom feature generators allow creating new types of geometries
- Mode-based interactions for drawing, selecting, and direct editing
- Designed for Deck.gl and MapLibre GL, with potential support for other renderers

> ⚠️ Work in progress. API and features may change.

### Installation

```bash
npm i olafvisker/decklibre-draw
```

### Usage

```ts
// Create map and deck instances
const map = new maplibregl.Map({...});
const deck = new Deck({...});

// Create DrawController with initial modes and options
const controller = new DrawController(deck, map, {
  initialMode: "select",
  modes: {
    select: new SimpleSelectMode({ dragWithoutSelect: true }),
    custom: new CustomDrawMode(),
    ...DEFAULT_MODES
  },
  onUpdate: (features) => console.log("Updated features", features),
});

// Switch modes, switch & update options, update options
controller.changeMode("circle");
controller.changeMode<SimpleSelectMode>("select", { dragWithoutSelect: false });
controller.changeModeOptions<SimpleSelectMode>("select", { dragWithoutSelect: true });
```

### Default Modes

| Name        | Class                | Description                    |
| ----------- | -------------------- | ------------------------------ |
| `static`    | `StaticMode`         | View-only mode                 |
| `select`    | `SelectMode`         | Select and drag features       |
| `edit`      | `EditMode`           | Drag and edit feature vertices |
| `point`     | `DrawPointMode`      | Draw points                    |
| `line`      | `DrawLineStringMode` | Draw lines                     |
| `polygon`   | `DrawPolygonMode`    | Draw polygons                  |
| `circle`    | `DrawCircleMode`     | Draw circles                   |
| `rectangle` | `DrawRectangleMode`  | Draw rectangles                |

> All default modes are automatically registered and can be overridden in the constructor.
> Here’s an updated paragraph you can add to the README describing the **mode interface** for custom modes:

### Creating Custom Modes

All interaction modes in **decklibre-draw** implement the `DrawMode` interface. A mode is essentially an object with optional lifecycle and event handler methods:

```ts
export interface DrawInfo {
  x: number;
  y: number;
  lng: number;
  lat: number;
  feature: Feature | undefined;
}

export interface DrawMode {
  onEnter?: (draw: DrawController) => void; // Called when the mode becomes active
  onExit?: (draw: DrawController) => void; // Called when the mode is exited

  onClick?: (info: DrawInfo, draw: DrawController) => void;
  onDoubleClick?: (info: DrawInfo, draw: DrawController) => void;
  onMouseMove?: (info: DrawInfo, draw: DrawController) => void;
  onMouseDown?: (info: DrawInfo, draw: DrawController) => void;
  onMouseUp?: (info: DrawInfo, draw: DrawController) => void;
}
```
