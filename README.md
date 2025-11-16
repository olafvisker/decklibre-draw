# decklibre-draw

![Tool](assets/tool.gif)

**decklibre-draw** is a lightweight library for drawing and editing geometries on **Deck.gl** and **MapLibre GL**. Modes define a **feature generator** and a **handle edit** function, which separate editable points (handles) from the final shapes themselves.

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
    select: new SelectMode({ dragWithoutSelect: true }),
    custom: new CustomDrawMode(),
    ...DEFAULT_MODES
  }
});

draw.on("feature:change", (e) => console.log(e.features));

// Switch modes, switch & update options, update options
controller.changeMode("circle");
controller.changeMode<SelectMode>("select", { dragWithoutSelect: false });
controller.changeModeOptions<SelectMode>("select", { dragWithoutSelect: true });
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

### Events

| Event            | Payload                         | Description                  |
| ---------------- | ------------------------------- | ---------------------------- |
| `feature:add`    | `{ features: Feature[] }`       | Returns added features       |
| `feature:remove` | `{ ids: (string \| number)[] }` | Returns removed feature ids  |
| `feature:update` | `{ features: Feature[] }`       | Returns updated features     |
| `feature:change` | `{ features: Feature[] }`       | Returns all current features |

#### Selection Events

| Event              | Payload                                 | Description                      |
| ------------------ | --------------------------------------- | -------------------------------- |
| `selection:change` | `{ selectedIds: (string \| number)[] }` | Returns all selected feature Ids |

#### Mode Events

| Event          | Payload                                           | Description                                        |
| -------------- | ------------------------------------------------- | -------------------------------------------------- |
| `mode:change`  | `{ name: string; options?: Record<string, any> }` | Fired when the draw mode changes                   |
| `mode:options` | `{ name: string; options: Record<string, any> }`  | Fired when options of the current mode are updated |

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
  readonly name: string;

  onEnter?: (draw: DrawController) => void;
  onExit?: (draw: DrawController) => void;

  onClick?: (info: DrawInfo, draw: DrawController) => void;
  onDoubleClick?: (info: DrawInfo, draw: DrawController) => void;
  onMouseMove?: (info: DrawInfo, draw: DrawController) => void;
  onMouseDown?: (info: DrawInfo, draw: DrawController) => void;
  onMouseUp?: (info: DrawInfo, draw: DrawController) => void;

  generate?(
    draw: DrawController,
    points: Position[],
    id?: string | number,
    props?: Record<string, unknown>
  ): Feature | undefined;

  edit?(context: EditContext): Position[];
}
```
