import { DrawMode, DrawController, DrawInfo } from "../core";
import type { Feature, Point, Position } from "geojson";
import { toMercator, toWgs84, point } from "@turf/turf";
import { SelectMode } from "./select-mode";
import { type EditorFn } from "../editors/editors";

interface EditModeOptions {
  selectedId?: string | number;
  dragWithoutSelect?: boolean;
  editors?: Record<string, EditorFn>;
}

export class EditMode implements DrawMode {
  public startSelectedId?: string | number;
  public dragWithoutSelect = false;

  private _dragging = false;
  private _dragType: "feature" | "handle" | null = null;
  private _dragStartCoord?: Position;
  private _dragFeatureId?: string | number;
  private _dragHandleIndex?: number;

  constructor({ selectedId, dragWithoutSelect }: EditModeOptions = {}) {
    this.startSelectedId = selectedId;
    if (dragWithoutSelect) this.dragWithoutSelect = dragWithoutSelect;
  }

  onEnter(draw: DrawController) {
    draw.setCursor({ default: "default", hover: "pointer" });
    if (this.startSelectedId) draw.store.setSelected(this.startSelectedId);
    this.createHandles(draw);
  }

  onExit(draw: DrawController) {
    this.startSelectedId = undefined;
    this.deselectAll(draw);
    this.resetDragState();
  }

  onClick(info: DrawInfo, draw: DrawController) {
    const f = info.feature;
    if (!f || !f.id) return this.deselectAll(draw);

    const { handle, midpoint, insertIndex } = f.properties || {};
    if (handle) return;

    if (midpoint) {
      const selected = this.getSelectedFeature(draw);
      if (!selected) return;
      this.insertVertex(draw, insertIndex, [info.lng, info.lat]);
      this.createHandles(draw);
      return;
    }

    if (!draw.store.isSelected(f.id)) {
      draw.changeMode<SelectMode>("select", { startSelectedId: f.id });
    }
  }

  onMouseDown(info: DrawInfo, draw: DrawController) {
    const f = info.feature;
    if (!f || !f.id) return draw.setDoubleClickZoom(true);

    const { handle, midpoint, _handleIndex, insertIndex } = f.properties || {};

    if (this.dragWithoutSelect || draw.store.isSelected(f.id)) {
      if (!handle && !midpoint) {
        this._dragging = true;
        this._dragFeatureId = f.id;
        this._dragType = "feature";
        this._dragStartCoord = [info.lng, info.lat];
        draw.setPanning(false);
        draw.setDoubleClickZoom(false);
        return;
      }
    }

    if (midpoint) {
      const selected = this.getSelectedFeature(draw);
      if (!selected) return;
      this.insertVertex(draw, insertIndex, [info.lng, info.lat]);
      this.startDrag("handle", info, insertIndex + 1, draw);
      this.createHandles(draw);
      return;
    }

    if (handle) return this.startDrag("handle", info, _handleIndex, draw);
    if (draw.store.isSelected(f.id)) this.startDrag("feature", info, undefined, draw);
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (this._dragging && this._dragFeatureId && this._dragStartCoord && this._dragType === "feature") {
      const feature = draw.store.getFeature(this._dragFeatureId);
      if (!feature) return;

      const [dx, dy] = [info.lng - this._dragStartCoord[0], info.lat - this._dragStartCoord[1]];
      const updated = this.translateFeature(feature, dx, dy, draw);
      draw.store.updateFeature(feature.id, updated);

      this._dragStartCoord = [info.lng, info.lat];
      this.createHandles(draw);
      return;
    }

    // Updated handle drag logic using handle editors
    const selected = this.getSelectedFeature(draw);
    if (!this._dragging || !selected || !this._dragStartCoord) return;

    const [dx, dy] = [info.lng - this._dragStartCoord[0], info.lat - this._dragStartCoord[1]];
    this._dragStartCoord = [info.lng, info.lat];

    if (this._dragType === "handle" && typeof this._dragHandleIndex === "number") {
      const updated = this.editHandle(selected, this._dragHandleIndex, dx, dy, draw);
      draw.store.updateFeature(selected.id, updated);
      this.createHandles(draw);
    }
  }

  onMouseUp(info: DrawInfo, draw: DrawController) {
    this.resetDragState();
    this._dragFeatureId = undefined;
    draw.setPanning(true);

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
    draw.setPanning(false);
    draw.setDoubleClickZoom(false);
  }

  // === Geometry Editing (using Handle Editors) ===
  private translateFeature(feature: Feature, dx: number, dy: number, draw: DrawController): Feature {
    const handles: Position[] = feature.properties?.handles || [];
    const moved = handles.map(([x, y]) => [x + dx, y + dy]);
    return this.regenerateFeature(draw, feature, moved);
  }

  /**
   * Use controller's handle editor registry
   */
  private editHandle(feature: Feature, handleIndex: number, dx: number, dy: number, draw: DrawController): Feature {
    const handles: Position[] = feature.properties?.handles || [];

    // Get editor from controller's registry
    const editor = this.getEditorForFeature(feature, draw);

    const result = editor({
      feature,
      handleIndex,
      handles,
      delta: [dx, dy],
      draw,
    });

    const updated = this.regenerateFeature(draw, feature, result.handles);

    if (result.additionalUpdates) {
      Object.assign(updated, result.additionalUpdates);
    }

    return updated;
  }

  private getEditorForFeature(feature: Feature, draw: DrawController): EditorFn {
    const editor = draw.getEditor(feature.properties?.editor);
    if (editor) return editor;
    return draw.getEditor("isolated")!;
  }

  private insertVertex(draw: DrawController, index: number, coord: Position) {
    const selected = this.getSelectedFeature(draw);
    if (!selected) return;

    const handles = selected.properties?.handles || [];
    const updatedHandles = [...handles];
    updatedHandles.splice(index + 1, 0, coord);

    const updated = this.regenerateFeature(draw, selected, updatedHandles);
    draw.store.updateFeature(selected.id, updated);
  }

  // === Handle Management ===
  private createHandles(draw: DrawController) {
    const selected = this.getSelectedFeature(draw);
    if (!selected) return;
    draw.store.clearHandles(selected.id);

    const coords: Position[] = selected.properties?.handles || [];
    coords.map((c, i) => draw.store.createHandle(selected.id!, c, i));

    if (selected.properties?.insertable !== false) {
      this.makeMidpoints(coords, selected.geometry.type === "Polygon", draw);
    }
  }

  private makeMidpoints(coords: Position[], isPolygon: boolean, draw: DrawController) {
    for (let i = 0; i < coords.length - 1; i++) {
      this.makeMidpoint(coords[i], coords[i + 1], i, draw);
    }

    if (isPolygon && coords.length > 2) {
      this.makeMidpoint(coords[coords.length - 1], coords[0], coords.length - 1, draw);
    }
  }

  private makeMidpoint(a: Position, b: Position, i: number, draw: DrawController): Feature<Point> {
    const ma = toMercator(point(a)).geometry.coordinates;
    const mb = toMercator(point(b)).geometry.coordinates;
    const mid = toWgs84(point([(ma[0] + mb[0]) / 2, (ma[1] + mb[1]) / 2])).geometry.coordinates;

    const handle = draw.store.createHandle(this.getSelectedFeature(draw)!.id!, mid);
    handle.properties = { ...handle.properties, midpoint: true, insertIndex: i };
    return handle;
  }

  // === Selection ===
  private deselectAll(draw: DrawController) {
    const selected = this.getSelectedFeature(draw);
    if (selected) draw.store.clearHandles(selected.id);
    draw.store.clearSelection();
  }

  private getSelectedFeature(draw: DrawController): Feature | undefined {
    const id = draw.store.selectedIds[0];
    if (!id) return;
    return draw.store.getFeature(id);
  }

  // === Core helper ===
  private regenerateFeature(draw: DrawController, feature: Feature, coords: Position[]): Feature {
    const generatorName = feature.properties?.generator;
    const props = { ...feature.properties, handles: coords };

    if (generatorName) {
      const regenerated = draw.generateFeature(generatorName, coords, { id: feature.id, props });
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
