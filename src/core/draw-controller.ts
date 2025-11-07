import type { Deck } from "@deck.gl/core";
import type { Feature } from "geojson";
import type { DrawInfo, DrawMode } from "./draw-mode";
import { DrawStore, type DrawStoreOptions } from "./draw-store";
import { v4 as uuid } from "uuid";

export type CursorState = "default" | "grab" | "grabbing" | "crosshair" | "pointer" | "wait" | "move";

export interface CursorOptions {
  default?: CursorState;
  hover?: CursorState;
  pan?: CursorState;
}

export interface DrawControllerOptions extends DrawStoreOptions {
  initialMode?: DrawMode | (new (options?: unknown) => DrawMode);
  layerIds?: string[];
}

export class DrawController {
  private _deck: Deck;
  private _map: maplibregl.Map;
  private _mode?: DrawMode;
  private _store: DrawStore;
  private _layerIds: string[] = [];
  private _panning = false;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private _modeInstances = new Map<Function, DrawMode>();

  constructor(deck: Deck, map: maplibregl.Map, options?: DrawControllerOptions) {
    this._deck = deck;
    this._map = map;
    this._store = new DrawStore({
      features: options?.features,
      shapeGenerators: options?.shapeGenerators,
      onUpdate: options?.onUpdate,
    });

    this._layerIds = options?.layerIds ?? [];
    if (options?.initialMode) this.changeMode(options.initialMode);

    this._bindEvents();
  }

  /** Getters */
  public get features(): Feature[] {
    return this._store.features;
  }

  public get store(): DrawStore {
    return this._store;
  }

  /** Cleanup */
  public destroy() {
    this._unbindEvents();
  }

  /** Mode handling */
  public changeMode<M extends DrawMode, O extends ConstructorParameters<new (options?: unknown) => M>[0]>(
    modeOrInstance: (new (options?: O) => M) | M,
    options?: O
  ) {
    let newMode: M;

    if (typeof modeOrInstance === "function") {
      // Reuse existing instance if no options provided
      if (!options && this._modeInstances.has(modeOrInstance)) {
        newMode = this._modeInstances.get(modeOrInstance) as M;
      } else {
        newMode = new modeOrInstance(options);
        // Cache instance only if no options are passed
        this._modeInstances.set(modeOrInstance, newMode);
      }
    } else {
      if (options !== undefined) {
        throw new Error("Cannot pass options when passing an instance.");
      }
      newMode = modeOrInstance;
    }

    this._mode?.onExit?.(this);
    this._reset();
    this._mode = newMode;
    this._mode.onEnter?.(this);
  }

  /** Cursor handling */
  public setCursor(cursor: CursorState | CursorOptions) {
    this._deck.setProps({
      getCursor: (state) => {
        if (typeof cursor === "string") return cursor;
        if (this._panning) return cursor.pan ?? cursor.default ?? "default";
        if (state.isHovering) return cursor.hover ?? cursor.default ?? "default";
        return cursor.default ?? "default";
      },
    });
  }

  /** Deck/map helpers */
  public setDraggability(enabled: boolean) {
    if (enabled) {
      this._map.dragRotate.enable();
      this._map.dragPan.enable();
    } else {
      this._map.dragRotate.disable();
      this._map.dragPan.disable();
    }
  }

  public setDoubleClickZoom(enabled: boolean) {
    if (enabled) {
      this._map.doubleClickZoom.enable();
    } else {
      this._map.doubleClickZoom.disable();
    }
  }

  private _reset() {
    this.setDraggability(true);
    this.setDoubleClickZoom(true);
    this.setCursor("default");
  }

  /** Event binding */
  private _bindEvents() {
    this._map.on("load", this._warmUp);
    this._map.on("dragstart", this._onPanStart);
    this._map.on("drag", this._onPanning);
    this._map.on("dragend", this._onPanEnd);
    this._map.on("mousedown", this._onMouseDown);
    this._map.on("mousemove", this._onMouseMove);
    this._map.on("mouseup", this._onMouseUp);
    this._map.on("click", this._onClick);
    this._map.on("dblclick", this._onDoubleClick);
  }

  private _unbindEvents() {
    this._map.off("load", this._warmUp);
    this._map.off("dragstart", this._onPanStart);
    this._map.off("drag", this._onPanning);
    this._map.off("dragend", this._onPanEnd);
    this._map.off("mousedown", this._onMouseDown);
    this._map.off("mousemove", this._onMouseMove);
    this._map.off("mouseup", this._onMouseUp);
    this._map.off("click", this._onClick);
    this._map.off("dblclick", this._onDoubleClick);
  }

  /** Event handlers */
  /** Warm up deck.gl to avoid lazy init issues */
  private _warmUp = () => {
    const tempFeatures: Feature[] = [
      {
        id: uuid(),
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: {},
      },
      {
        id: uuid(),
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
        properties: {},
      },
      {
        id: uuid(),
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [0, 1],
              [1, 1],
              [0, 0],
            ],
          ],
        },
        properties: {},
      },
    ];
    this._store.addFeatures(tempFeatures);
    requestAnimationFrame(() => {
      this._store.removeFeatures(tempFeatures.map((f) => f.id));
    });
  };

  private _onMouseDown = (e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) =>
    this._mode?.onMouseDown?.(this._buildInfo(e), this);

  private _onMouseMove = (e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) =>
    this._mode?.onMouseMove?.(this._buildInfo(e), this);

  private _onMouseUp = (e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) =>
    this._mode?.onMouseUp?.(this._buildInfo(e), this);

  private _onClick = (e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) =>
    this._mode?.onClick?.(this._buildInfo(e), this);

  private _onDoubleClick = (e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) =>
    this._mode?.onDoubleClick?.(this._buildInfo(e), this);

  private _onPanStart = () => {
    this._panning = true;
  };

  private _onPanning = () => {};
  private _onPanEnd = () => {
    this._panning = false;
  };

  private _buildInfo(event: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent): DrawInfo {
    const { x, y } = event.point;
    const { lng, lat } = event.lngLat;
    const picked = this._deck.pickObject({ x, y, layerIds: this._layerIds, radius: this._deck.props.pickingRadius });
    return {
      x,
      y,
      lng,
      lat,
      feature: picked?.object,
    };
  }
}
