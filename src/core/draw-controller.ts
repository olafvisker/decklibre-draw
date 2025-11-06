import type { Deck } from "@deck.gl/core";
import type { Feature, Point, Position } from "geojson";
import type { DrawMode } from "./draw-mode";
import { circle, distance, point } from "@turf/turf";
import { v4 as uuid } from "uuid";

export interface DrawInfo {
  x: number;
  y: number;
  lng: number;
  lat: number;
  feature: Feature | undefined;
}

export type CursorState = "default" | "grab" | "grabbing" | "crosshair" | "pointer" | "wait" | "move";

export interface CursorOptions {
  default?: CursorState;
  hover?: CursorState;
  pan?: CursorState;
}

export type FeatureGenerator = (vertices: Position[], data?: string) => Feature | undefined;

export interface DrawControllerOptions {
  initialMode?: DrawMode;
  features?: Feature[];
  onUpdate?: (features: Feature[]) => void;
  featureGenerators?: Record<string, FeatureGenerator>;
}

export class DrawController {
  private _deck: Deck;
  private _map: maplibregl.Map;
  private _mode?: DrawMode;
  private _features: Feature[] = [];
  private _onUpdate?: (features: Feature[]) => void;
  private _panning = false;
  private _featureGenerators: Record<string, FeatureGenerator> = {};

  constructor(deck: Deck, map: maplibregl.Map, options?: DrawControllerOptions) {
    this._deck = deck;
    this._map = map;
    this._features = options?.features ?? [];
    this._onUpdate = options?.onUpdate ?? (() => {});
    this._featureGenerators = {
      circle: (points: Position[]) => {
        if (points.length < 2) return undefined;
        const center = points[0];
        const edge = points[1];
        const radius = distance(point(center), point(edge), { units: "meters" });
        return circle(center, radius, { steps: 64, units: "meters" });
      },
      ...options?.featureGenerators,
    };
    if (options?.initialMode) this.changeMode(options?.initialMode);

    this._warmUp();
    this._bindEvents();
  }

  public get features() {
    return this._features;
  }

  public set features(newFeatures: Feature[]) {
    this._features = newFeatures;
    this._onUpdate?.(this._features);
  }

  public destroy() {
    this._unbindEvents();
  }

  public changeMode(newMode: DrawMode) {
    this._mode?.onExit?.(this);
    this._reset();
    this._mode = newMode;
    this._mode.onEnter?.(this);
  }

  private _updateFeatures(mutator: (prev: Feature[]) => Feature[]) {
    this.features = mutator(this._features);
  }

  public addFeature(feature: Feature) {
    this._updateFeatures((prev) => [...prev, feature]);
  }

  public addFeatures(feature: Feature[]) {
    this._updateFeatures((prev) => [...prev, ...feature]);
  }

  public removeFeature(id: string | number | undefined) {
    this._updateFeatures((prev) => prev.filter((f) => f.id !== id));
  }

  public removeFeatures(ids: (string | number | undefined)[]) {
    if (!ids.length) return;
    this._updateFeatures((prev) => prev.filter((f) => !ids.includes(f.id)));
  }

  public updateFeature(id: string | number | undefined, updates: Partial<Feature>) {
    this._updateFeatures((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates, properties: { ...f.properties, ...updates.properties } } : f))
    );
  }

  public createHandle(coord: Position, index?: number): Feature<Point> {
    return {
      id: uuid(),
      type: "Feature",
      geometry: { type: "Point", coordinates: coord },
      properties: { handle: true, _handleIndex: index ?? undefined },
    };
  }

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

  public generateFeature(name: string, points: Position[], data?: string) {
    const generator = this._featureGenerators[name];
    if (!generator) {
      console.warn(`Generator "${name}" not found.`);
      return;
    }

    return generator(points, data);
  }

  private _warmUp() {
    // Optional: pre-render dummy features to prevent Deck.gl lazy init
    const prev = this._features;
    this.features = [
      { type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: {} },
      {
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
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [0, 1],
              [1, 1],
            ],
          ],
        },
        properties: {},
      },
    ];
    requestAnimationFrame(() => {
      this.features = prev;
    });
  }

  private _bindEvents() {
    this._map.on("dragstart", this._onPanStart);
    this._map.on("drag", this._onPanning);
    this._map.on("dragend", this._onPanEnd);
    this._map.on("mousedown", this._onMouseDown);
    this._map.on("mousemove", this._onMouseMove);
    this._map.on("mouseup", this._onMouseUp);
    this._map.on("", this._onMouseMove);
    this._map.on("click", this._onClick);
    this._map.on("dblclick", this._onDoubleClick);
  }

  private _unbindEvents() {
    this._map.off("dragstart", this._onPanStart);
    this._map.off("drag", this._onPanning);
    this._map.off("dragend", this._onPanEnd);
    this._map.off("mousedown", this._onMouseDown);
    this._map.off("mousemove", this._onMouseMove);
    this._map.off("mouseup", this._onMouseUp);
    this._map.off("", this._onMouseMove);
    this._map.off("click", this._onClick);
    this._map.off("dblclick", this._onDoubleClick);
  }

  private _reset() {
    this.setDraggability(true);
    this.setDoubleClickZoom(true);
    this.setCursor("default");
  }

  private _onMouseDown = (e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) => {
    this._mode?.onMouseDown?.(this._buildInfo(e), this);
  };

  private _onMouseMove = (e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) => {
    this._mode?.onMouseMove?.(this._buildInfo(e), this);
  };

  private _onMouseUp = (e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) => {
    this._mode?.onMouseUp?.(this._buildInfo(e), this);
  };

  private _onClick = (e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) => {
    this._mode?.onClick?.(this._buildInfo(e), this);
  };

  private _onDoubleClick = (e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) => {
    this._mode?.onDoubleClick?.(this._buildInfo(e), this);
  };

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
    const picked = this._deck.pickObject({ x, y, radius: this._deck.props.pickingRadius });
    return {
      x,
      y,
      lng,
      lat,
      feature: picked?.object,
    };
  }
}
