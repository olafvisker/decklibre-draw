# 🦚 decklibre-draw ([🌐 Live Demo](https://olafvisker.github.io/decklibre-draw/))

![Tool](assets/tool.gif)

**decklibre-draw** is a lightweight library for drawing and editing geometries on **Deck.gl** and **MapLibre GL**. Modes define a **feature generator** and a **control point edit** function, which separate editable points (control points) from the final shapes themselves.

- Draw and edit points, lines, polygons, circles, and rectangles
- Custom feature generators allow creating new types of geometries
- Mode-based interactions for drawing, selecting, and direct editing
- Designed for Deck.gl and MapLibre GL, with potential future support for other renderers

> ⚠️ Work in progress. API and features may change.

## Try the Demo Online

You can try **decklibre-draw** directly in your browser here:

[Live Demo](https://olafvisker.github.io/decklibre-draw/)

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

// Switch modes and update options
controller.changeMode("circle");
controller.changeMode<SelectMode>("select", { dragWithoutSelect: false });

// Update mode options (automatically merges properties)
controller.changeModeOptions<SelectMode>("select", { dragWithoutSelect: true });
controller.changeModeOptions("point", { properties: { color: "red" } });

// To fully replace properties, access the mode directly
controller.getMode("point").properties = { color: "blue" };
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

#### Default Properties

Set default properties that are automatically added to every feature drawn with a mode:

```ts
// When creating a mode
const pointMode = new DrawPointMode({ 
  properties: { color: 'red', category: 'marker' }
});

// Update properties dynamically (automatically merges)
controller.changeModeOptions("point", { properties: { color: 'blue' } });

// Replace properties entirely (direct access)
controller.getMode("point").properties = { color: 'green', size: 10 };
```

#### Programmatic Feature Creation

Create features programmatically using a mode's generator:

```ts
// Via controller (using control points)
controller.createFeature("point", [[lng, lat]], { type: 'marker' });

// Or directly via mode
const mode = controller.getMode("point");
mode?.createFeature(controller, [[lng, lat]], { type: 'marker' });
```

Both methods use the mode's `generate()` function to create features and add them to state. The control points you pass are stored, making features immediately editable. For features added directly to state (without using `createFeature`), control points are automatically extracted from the geometry when first accessed.

### Feature Properties

Features created by decklibre-draw include standard properties for editing and selection. Understanding these properties helps when styling features or creating custom modes.

> **Note:** Control points are stored separately in the DrawState, not in feature properties. This keeps your GeoJSON clean and separates UI state from data.

#### Required Properties (for editable features)

| Property | Type | Description |
|----------|------|-------------|
| `mode` | `string` | The name of the mode that created this feature. Used to find the correct generator when regenerating during edits. |

#### Optional Standard Properties

| Property | Type | Description |
|----------|------|-------------|
| `selected` | `boolean` | Whether the feature is currently selected. Automatically managed by DrawState. |
| `preview` | `boolean` | Whether the feature is a preview (temporary during drawing). |
| `insertable` | `boolean` | Whether midpoint control points can be inserted to add vertices. Default: `true` for lines/polygons, `false` for circles/rectangles. |

#### Control Point-specific Properties

Features representing edit control points have special properties:

| Property | Type | Description |
|----------|------|-------------|
| `controlPoint` | `boolean` | Marks this as a vertex control point that can be dragged. |
| `midpoint` | `boolean` | Marks this as a midpoint control point (between vertices) for inserting new points. |
| `featureId` | `string \| number` | The ID of the parent feature this control point belongs to. |
| `index` | `number` | The index of this control point in the control points array. |

#### Grouped Features Properties

For features that should move/edit together:

| Property | Type | Description |
|----------|------|-------------|
| `groupId` | `string \| number` | **Optional.** Links multiple features together. All features with the same `groupId` are selected/moved/edited as one. The first feature in the group is considered the primary feature. |

**Example feature with standard properties:**

```ts
{
  type: "Feature",
  id: "unique-id",
  geometry: { type: "Polygon", coordinates: [...] },
  properties: {
    mode: "polygon",           // Required: mode that created it
    selected: false,           // Managed by state
    preview: false,            // Managed during drawing
    insertable: true,          // Optional: allow vertex insertion
    customProp: "value"        // Your custom properties
  }
}
```

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

All interaction modes in **decklibre-draw** implement the `DrawMode` interface. A mode is essentially an object with optional lifecycle and event handler methods.

A mode defines **two independent parts**:

- **`generate()` → Shape creation**
  Converts clicked **points (control points)** into the final GeoJSON geometry.
  The rendered shape is always derived from these points.

- **`edit()` → Control point editing**
  Controls how control points move and how their movement updates the underlying points.
  This fully separates **editing logic from drawing logic**.

Because of this separation:

- The shape can be fully independent from its control points.
- Custom geometries can define completely custom editing behavior independent from drawing

```ts
export interface DrawInfo {
  x: number;
  y: number;
  lng: number;
  lat: number;
  feature: Feature | undefined;
}

export interface DrawMode {
  name: string;

  onEnter?: (draw: DrawController) => void;
  onExit?: (draw: DrawController) => void;

  onClick?: (info: DrawInfo, draw: DrawController, event: MapMouseEvent | MapTouchEvent) => void;
  onDoubleClick?: (info: DrawInfo, draw: DrawController, event: MapMouseEvent | MapTouchEvent) => void;
  onMouseMove?: (info: DrawInfo, draw: DrawController, event: MapMouseEvent | MapTouchEvent) => void;
  onMouseDown?: (info: DrawInfo, draw: DrawController, event: MapMouseEvent | MapTouchEvent) => void;
  onMouseUp?: (info: DrawInfo, draw: DrawController, event: MapMouseEvent | MapTouchEvent) => void;

  generate?(
    draw: DrawController,
    points: Position[],
    ids?: (string | number)[],
    props?: Partial<ShapeFeatureProperties>
  ): Feature[];

  createFeature?(draw: DrawController, points: Position[], props?: Partial<ShapeFeatureProperties>): Feature[];

  edit?(context: EditContext): Position[];
}
```

**Event handlers** now receive the raw MapLibre event as a third parameter, giving you access to:
- `event.preventDefault()` - prevent default map behaviors (like zoom)
- `event.shiftKey`, `event.ctrlKey`, `event.metaKey` - modifier keys
- `event.button` - which mouse button was clicked

You can also extend the `BaseDrawMode` which handles the basic coordinate collection, preview rendering, control points, and finishing logic for you.

- **pointCount** – Auto-finish after N clicks (otherwise double-click finishes)
- **controlPointDisplay** – Which control points are shown while drawing (`none`, `all`, `last`, `first`, `first-last`)

```ts
export class DrawTriangleMode extends BaseDrawMode {
  name = "triangle";

  constructor() {
    super({ pointCount: 3, controlPointDisplay: "first-last" });
  }

  generate(
    _draw: DrawController,
    points: Position[],
    ids?: (string | number)[],
    props?: Partial<ShapeFeatureProperties>
  ): Feature<Polygon>[] {
    if (points.length < 3) return [];

    const feature: Feature<Polygon> = {
      type: "Feature",
      id: ids?.[0] ?? uuid(),
      geometry: {
        type: "Polygon",
        coordinates: [[...points, points[0]]],
      },
      properties: { ...props, mode: this.name },
    };

    return [feature];
  }
}
```

### Grouped Features

The `generate()` method can return multiple features that behave as a single unit when selecting, moving, and editing. This is useful for creating complex geometries with different visual components.

**Key concepts:**
- Return an array of features from `generate()`
- Add a `groupId` to link features together
- The first feature in the array is the primary feature
- All features in the group move/edit together
- Only the primary feature shows edit control points

```ts
export class CircleWithBoxMode extends BaseDrawMode {
  name = "circle-with-box";

  constructor() {
    super({ pointCount: 2, controlPointDisplay: "first" });
  }

  generate(
    _draw: DrawController,
    points: Position[],
    ids?: (string | number)[],
    props?: Partial<ShapeFeatureProperties>,
  ): Feature[] {
    if (points.length < 2) return [];

    // Reuse existing groupId if updating, otherwise create new one
    const groupId = (props?.groupId as string | number) ?? uuid();
    const featureIds = ids && ids.length >= 2 ? ids : [uuid(), uuid()];

    // Generate the circle using the same logic as DrawCircleMode
    const circleFeature = generateCircle(points, { steps: 64 });

    // Calculate bounding box
    const center = points[0];
    const radius = distance(point(center), point(points[1]), { units: "meters" });

    // Create box corners (square bounding box)
    const boxRadius = radius * Math.SQRT2; // Diagonal distance to contain circle
    const topLeft = destination(center, boxRadius, -135, { units: "meters" }).geometry.coordinates;
    const topRight = destination(center, boxRadius, -45, { units: "meters" }).geometry.coordinates;
    const bottomRight = destination(center, boxRadius, 45, { units: "meters" }).geometry.coordinates;
    const bottomLeft = destination(center, boxRadius, 135, { units: "meters" }).geometry.coordinates;

    // Circle (primary feature - listed first)
    const circle: Feature<Polygon> = {
      type: "Feature",
      id: featureIds[0],
      geometry: circleFeature.geometry,
      properties: {
        ...props,
        mode: this.name,
        groupId,
        insertable: false,
      },
    };

    // Bounding box (secondary feature)
    const box: Feature<Polygon> = {
      type: "Feature",
      id: featureIds[1],
      geometry: {
        type: "Polygon",
        coordinates: [[topLeft, topRight, bottomRight, bottomLeft, topLeft]],
      },
      properties: {
        ...props,
        mode: this.name,
        groupId,
        isBox: true, // Custom property for styling
        insertable: false,
      },
    };

    return [circle, box]; // First feature is primary
  }
}
```

**How it works:**
- When you click any feature in the group, the whole group is selected
- Dragging moves all features together based on the primary feature's control points
- Editing control points (in edit mode) updates all features in the group
- Each feature can have its own properties (colors, styles, etc.)
- The primary feature is always the first one in the returned array
