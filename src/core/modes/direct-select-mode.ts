import type { DrawInfo, DrawMode } from "../draw-mode";
import type { DrawController } from "../draw-controller";
import type { Feature, Point, Position } from "geojson";
import { toMercator, toWgs84, point } from "@turf/turf";
import { SimpleSelectMode } from "./simple-select-mode";

interface DirectSelectModeOptions {
  activeFeatureId?: string | number;
}

export class DirectSelectMode implements DrawMode {
  private _activeFeatureId?: string | number;
  private _dragging = false;
  private _dragType: "feature" | "handle" | null = null;
  private _dragStartCoord?: Position;
  private _dragHandleIndex?: number;

  constructor({ activeFeatureId }: DirectSelectModeOptions = {}) {
    this._activeFeatureId = activeFeatureId;
  }

  // === Lifecycle ===
  onEnter(draw: DrawController) {
    draw.setCursor({ default: "default", hover: "pointer" });
    this.setActive(draw, this._activeFeatureId);
  }

  onExit(draw: DrawController) {
    this.deselectAll(draw);
    this.resetDragState();
  }

  // === Click & Drag ===
  onClick(info: DrawInfo, draw: DrawController) {
    const f = info.feature;
    if (!f) return this.deselectAll(draw);

    const { handle, midpoint, insertIndex } = f.properties || {};
    if (handle) return; // handled via drag

    if (midpoint && this._activeFeatureId !== undefined) {
      this.insertVertex(draw, insertIndex, [info.lng, info.lat]);
      this.createHandles(draw);
      return;
    }

    if (f.id !== this._activeFeatureId) {
      draw.changeMode(new SimpleSelectMode({ activeFeatureId: f.id }));
    }
  }

  onMouseDown(info: DrawInfo, draw: DrawController) {
    const f = info.feature;
    if (!f) return draw.setDoubleClickZoom(true);

    const { handle, midpoint, _handleIndex, insertIndex } = f.properties || {};

    if (midpoint && this._activeFeatureId !== undefined) {
      this.insertVertex(draw, insertIndex, [info.lng, info.lat]);
      this.startDrag("handle", info, insertIndex + 1, draw);
      this.createHandles(draw);
      return;
    }

    if (handle) return this.startDrag("handle", info, _handleIndex, draw);
    if (f.id === this._activeFeatureId) this.startDrag("feature", info, undefined, draw);
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (!this._dragging || !this._activeFeatureId || !this._dragStartCoord) return;

    const [dx, dy] = [info.lng - this._dragStartCoord[0], info.lat - this._dragStartCoord[1]];
    this._dragStartCoord = [info.lng, info.lat];

    const feature = draw.features.find((f) => f.id === this._activeFeatureId);
    if (!feature) return;

    let updated: Feature;

    if (this._dragType === "feature") {
      updated = this.translateFeature(feature, dx, dy, draw);
    } else if (this._dragType === "handle" && typeof this._dragHandleIndex === "number") {
      updated = this.moveVertex(feature, this._dragHandleIndex, dx, dy, draw);
    } else {
      return;
    }

    draw.store.updateFeature(feature.id, updated);
    this.createHandles(draw);
  }

  onMouseUp(info: DrawInfo, draw: DrawController) {
    this.resetDragState();
    draw.setDraggability(true);

    if (!info.feature || (!info.feature.properties?.handle && !info.feature.properties?.midpoint)) {
      draw.setDoubleClickZoom(true);
    }
  }

  // === Drag Helpers ===
  private resetDragState() {
    this._dragging = false;
    this._dragType = null;
    this._dragStartCoord = undefined;
    this._dragHandleIndex = undefined;
  }

  private startDrag(type: "feature" | "handle", info: DrawInfo, handleIndex: number | undefined, draw: DrawController) {
    this._dragging = true;
    this._dragType = type;
    this._dragStartCoord = [info.lng, info.lat];
    this._dragHandleIndex = handleIndex;
    draw.setDraggability(false);
    draw.setDoubleClickZoom(false);
  }

  // === Geometry Editing ===
  private translateFeature(feature: Feature, dx: number, dy: number, draw: DrawController): Feature {
    const handles: Position[] = feature.properties?.handles || [];
    const moved = handles.map(([x, y]) => [x + dx, y + dy]);
    return this.regenerateFeature(draw, feature, moved);
  }

  private moveVertex(feature: Feature, i: number, dx: number, dy: number, draw: DrawController): Feature {
    const handles: Position[] = feature.properties?.handles || [];
    const moved = handles.map((c, j) => (j === i ? [c[0] + dx, c[1] + dy] : c));
    return this.regenerateFeature(draw, feature, moved);
  }

  private insertVertex(draw: DrawController, index: number, coord: Position) {
    const feature = draw.features.find((f) => f.id === this._activeFeatureId);
    if (!feature) return;

    const handles = feature.properties?.handles || [];
    const updatedHandles = [...handles];
    updatedHandles.splice(index + 1, 0, coord);

    const updated = this.regenerateFeature(draw, feature, updatedHandles);
    draw.store.updateFeature(feature.id, updated);
  }

  // === Handle Management ===
  private createHandles(draw: DrawController) {
    if (!this._activeFeatureId) return;
    draw.store.clearHandles(this._activeFeatureId);

    const feature = draw.features.find((f) => f.id === this._activeFeatureId);
    if (!feature) return;

    const coords: Position[] = feature.properties?.handles || [];
    coords.map((c, i) => draw.store.createHandle(this._activeFeatureId!, c, i));
    if (feature.properties?.insertable !== false) this.makeMidpoints(coords, feature.geometry.type === "Polygon", draw);
  }

  private makeMidpoints(coords: Position[], isPolygon: boolean, draw: DrawController): Feature<Point>[] {
    const midpoints: Feature<Point>[] = [];
    for (let i = 0; i < coords.length - 1; i++) midpoints.push(this.makeMidpoint(coords[i], coords[i + 1], i, draw));
    if (isPolygon && coords.length > 2)
      midpoints.push(this.makeMidpoint(coords[coords.length - 1], coords[0], coords.length - 1, draw));
    return midpoints;
  }

  private makeMidpoint(a: Position, b: Position, i: number, draw: DrawController): Feature<Point> {
    const ma = toMercator(point(a)).geometry.coordinates;
    const mb = toMercator(point(b)).geometry.coordinates;
    const mid = toWgs84(point([(ma[0] + mb[0]) / 2, (ma[1] + mb[1]) / 2])).geometry.coordinates;

    const handle = draw.store.createHandle(this._activeFeatureId!, mid);
    handle.properties = { ...handle.properties, midpoint: true, insertIndex: i };
    return handle;
  }

  // === Selection ===
  private deselectAll(draw: DrawController) {
    if (this._activeFeatureId) draw.store.clearHandles(this._activeFeatureId);
    this._activeFeatureId = undefined;
    draw.features.forEach((f) => draw.store.updateFeature(f.id, { properties: { ...f.properties, active: false } }));
  }

  private setActive(draw: DrawController, id: string | number | undefined) {
    this._activeFeatureId = id;
    draw.features.forEach((f) =>
      draw.store.updateFeature(f.id, { properties: { ...f.properties, active: f.id === id } })
    );
    this.createHandles(draw);
  }

  // === Core helper ===
  private regenerateFeature(draw: DrawController, feature: Feature, coords: Position[]): Feature {
    const generatorName = feature.properties?.generator;
    const props = { ...feature.properties, handles: coords };

    if (generatorName) {
      const regenerated = draw.store.generateFeature(generatorName, coords, { id: feature.id, props });
      return regenerated || feature;
    }

    return {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: feature.geometry.type === "Point" ? coords[0] : coords,
      },
      properties: props,
    } as Feature;
  }
}
