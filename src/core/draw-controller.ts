import type { Deck } from "@deck.gl/core";
import type { Feature, Position } from "geojson";
import type { DrawInfo, DrawMode } from "./draw-mode";
import type { DrawStateEvents } from "./draw-state";
import { DrawState } from "./draw-state";
import { v4 as uuid } from "uuid";
import { Map as MaplibreMap, MapMouseEvent, MapTouchEvent } from "maplibre-gl";
import type { PointLike } from "maplibre-gl";
import {
  StaticMode,
  SelectMode,
  EditMode,
  DrawLineStringMode,
  DrawPolygonMode,
  DrawCircleMode,
  DrawRectangleMode,
  DrawPointMode,
} from "../modes";
import mitt from "mitt";

export type CursorState = "default" | "grab" | "grabbing" | "crosshair" | "pointer" | "wait" | "move";

export interface CursorOptions {
  default?: CursorState;
  hover?: CursorState;
  pan?: CursorState;
}

export interface DrawControllerOptions {
  features?: Feature[];
  modes?: Record<string, DrawMode>;
  initialMode?: string;
  layerIds?: string[];
  warmUp?: boolean;
}

export type DrawControllerEvents = DrawStateEvents & {
  "mode:change": { name: string; options?: Record<string, any> };
  "mode:options": { name: string; options: Record<string, any> };
};

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
  private _modes: Record<string, DrawMode> = {};

  private _state: DrawState;
  private _layerIds?: string[];

  private _panning = false;
  private _warmUpEnabled: boolean;
  private _emitter = mitt<DrawControllerEvents>();

  constructor(deck: Deck, map: MaplibreMap, options?: DrawControllerOptions) {
    this._deck = deck;
    this._map = map;

    this._state = new DrawState({ features: options?.features });
    this._modes = { ...DEFAULT_MODES, ...options?.modes };

    this._layerIds = options?.layerIds;
    this._warmUpEnabled = options?.warmUp ?? true;

    const initialModeName = options?.initialMode ?? "static";
    if (initialModeName && initialModeName in this._modes) {
      this.changeMode(initialModeName);
    }

    this._bindEvents();
  }

  public destroy() {
    this._unbindEvents();
  }

  public on = this._emitter.on;
  public off = this._emitter.off;
  private _emit = this._emitter.emit;

  /** Getters */
  public get features(): Feature[] {
    return this._state.features;
  }

  public get currentMode(): string | undefined {
    return this._modeName;
  }

  public get currentModeInstance(): DrawMode | undefined {
    return this._mode;
  }

  public get state(): DrawState {
    return this._state;
  }

  /** Mode Registry */
  public getMode(name: string): DrawMode | undefined {
    return this._modes[name];
  }

  public registerMode(name: string, instance: DrawMode) {
    if (!name) throw new Error("Mode name is required.");
    this._modes[name] = instance;
  }

  public unregisterMode(name: string) {
    if (!this._modes[name]) return;

    if (this._modeName === name) {
      this._mode?.onExit?.(this);
      this._reset();
      this._mode = undefined;
      this._modeName = undefined;
    }

    delete this._modes[name];
  }

  public changeMode<T extends DrawMode = DrawMode>(name: string, options?: Partial<T>): T {
    const mode = this._modes[name] as T | undefined;
    if (!mode) throw new Error(`Mode "${name}" is not registered.`);

    this._mode?.onExit?.(this);
    this._reset();

    this._mode = mode;
    this._modeName = name;

    if (options) Object.assign(mode, options);

    this._mode.onEnter?.(this);

    this._emit("mode:change", { name, options });
    return mode;
  }

  public changeModeOptions<T extends DrawMode>(name: string, options: Partial<T>): void {
    const mode = this._modes[name] as T | undefined;
    if (!mode) throw new Error(`Mode "${name}" is not registered.`);
    Object.assign(mode, options);

    this._emit("mode:options", { name, options });
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

  /** Map helpers */
  public setPanning(enabled: boolean) {
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

  public project(position: Position): Position {
    const [lng, lat] = position;
    const point = this._map.project([lng, lat]);
    return [point.x, point.y];
  }

  public unproject(point: Position): Position {
    const lngLat = this._map.unproject({ x: point[0], y: point[1] } as PointLike);
    return [lngLat.lng, lngLat.lat];
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

    const events: (keyof DrawStateEvents)[] = [
      "feature:add",
      "feature:remove",
      "feature:update",
      "feature:change",
      "selection:change",
    ];

    for (const type of events) {
      this._state.on(type, (e) => this._emit(type, e as any));
    }
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
    this._state.addFeatures(tempFeatures);
    requestAnimationFrame(() => {
      this._state.removeFeatures(tempFeatures.map((f) => f.id!.toString()));
    });
  };

  private _onMouseDown = (e: MapMouseEvent | MapTouchEvent) => this._mode?.onMouseDown?.(this._buildInfo(e), this);
  private _onMouseMove = (e: MapMouseEvent | MapTouchEvent) => this._mode?.onMouseMove?.(this._buildInfo(e), this);
  private _onMouseUp = (e: MapMouseEvent | MapTouchEvent) => this._mode?.onMouseUp?.(this._buildInfo(e), this);
  private _onClick = (e: MapMouseEvent | MapTouchEvent) => this._mode?.onClick?.(this._buildInfo(e), this);
  private _onDoubleClick = (e: MapMouseEvent | MapTouchEvent) => this._mode?.onDoubleClick?.(this._buildInfo(e), this);

  private _onPanStart = () => {
    this._panning = true;
  };
  private _onPanning = () => {};
  private _onPanEnd = () => {
    this._panning = false;
  };

  private _buildInfo(event: MapMouseEvent | MapTouchEvent): DrawInfo {
    const { x, y } = event.point;
    const { lng, lat } = event.lngLat;
    const picked = this._deck.pickObject({ x, y, layerIds: this._layerIds, radius: this._deck.props.pickingRadius });
    return { x, y, lng, lat, feature: picked?.object };
  }

  private _reset() {
    this.setPanning(true);
    this.setDoubleClickZoom(true);
    this.setCursor("default");
  }
}
