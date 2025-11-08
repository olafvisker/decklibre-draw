import type { Deck } from "@deck.gl/core";
import type { Feature } from "geojson";
import type { DrawInfo, DrawMode } from "./draw-mode";
import { DrawStore, type DrawStoreOptions } from "./draw-store";
import { v4 as uuid } from "uuid";
import { Map as MaplibreMap } from "maplibre-gl";
import {
  StaticMode,
  SelectMode,
  EditMode,
  DrawPointMode,
  DrawLineStringMode,
  DrawPolygonMode,
  DrawCircleMode,
  DrawRectangleMode,
} from "../modes";

export type CursorState = "default" | "grab" | "grabbing" | "crosshair" | "pointer" | "wait" | "move";

export interface CursorOptions {
  default?: CursorState;
  hover?: CursorState;
  pan?: CursorState;
}

export interface DrawControllerOptions extends DrawStoreOptions {
  modes?: Record<string, DrawMode>;
  initialMode?: string;
  layerIds?: string[];
  warmUp?: boolean;
}

export const DEFAULT_MODES: Record<string, DrawMode> = {
  static: new StaticMode(),
  select: new SelectMode(),
  edit: new EditMode(),
  point: new DrawPointMode(),
  line: new DrawLineStringMode(),
  polygon: new DrawPolygonMode(),
  circle: new DrawCircleMode(),
  rectangle: new DrawRectangleMode(),
};

export class DrawController {
  private _deck: Deck;
  private _map: MaplibreMap;

  private _mode?: DrawMode;
  private _modeName?: string;
  private _modes = new Map<string, DrawMode>();

  private _store: DrawStore;
  private _layerIds?: string[];

  private _panning = false;
  private _warmUpEnabled: boolean;

  constructor(deck: Deck, map: maplibregl.Map, options?: DrawControllerOptions) {
    this._deck = deck;
    this._map = map;
    this._store = new DrawStore({
      features: options?.features,
      shapeGenerators: options?.shapeGenerators,
      onUpdate: options?.onUpdate,
    });

    this._layerIds = options?.layerIds;
    this._warmUpEnabled = options?.warmUp ?? true;

    const initialModes = { ...DEFAULT_MODES, ...(options?.modes ?? {}) };
    for (const [name, instance] of Object.entries(initialModes)) {
      this.registerMode(name, instance);
    }

    const initialModeName = options?.initialMode ?? "static";
    if (initialModeName && this._modes.has(initialModeName)) {
      this.changeMode(initialModeName);
    }

    this._bindEvents();
  }

  public destroy() {
    this._unbindEvents();
  }

  /** Getters */
  public get features(): Feature[] {
    return this._store.features;
  }

  public get currentMode(): string | undefined {
    return this._modeName;
  }

  public get currentModeInstance(): DrawMode | undefined {
    return this._mode;
  }

  public get store(): DrawStore {
    return this._store;
  }

  /** Mode handling */
  public registerMode(name: string, instance: DrawMode) {
    if (!name) throw new Error("Mode name is required.");
    this._modes.set(name, instance);
  }

  public unregisterMode(name: string) {
    if (!this._modes.has(name)) return;
    if (this._modeName === name) {
      this._mode?.onExit?.(this);
      this._reset();
      this._mode = undefined;
      this._modeName = undefined;
    }
    this._modes.delete(name);
  }

  public getRegisteredModes(): string[] {
    return Array.from(this._modes.keys());
  }

  public changeMode<T extends DrawMode = DrawMode>(name: string, options?: Partial<T>): T {
    const mode = this._modes.get(name) as T | undefined;
    if (!mode) throw new Error(`Mode "${name}" is not registered.`);

    this._mode?.onExit?.(this);
    this._reset();

    this._mode = mode;
    this._modeName = name;

    if (options) Object.assign(mode, options);

    this._mode.onEnter?.(this);

    return mode;
  }

  public changeModeOptions<T extends DrawMode | unknown = DrawMode>(name: string, options: Partial<T>): void {
    const mode = this._modes.get(name) as T | undefined;
    if (!mode) throw new Error(`Mode "${name}" is not registered.`);
    Object.assign(mode, options);
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
    if (this._warmUpEnabled) this._map.on("load", this._warmUp);
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
    if (this._warmUpEnabled) this._map.off("load", this._warmUp);
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
    return { x, y, lng, lat, feature: picked?.object };
  }
}
