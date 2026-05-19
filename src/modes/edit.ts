import type { DrawInfo, HandleFeatureProperties, EditContext, HandleFeature } from "../core";
import type { DrawMode } from "../core";
import { DrawController } from "../core";
import { getGroupIds, getPrimaryFeature } from "../core/group-utils";
import type { Feature, Position } from "geojson";
import { toMercator, toWgs84, point } from "@turf/turf";
import { SelectMode } from "./select";

interface EditModeOptions {
  selectedId?: string | number;
  dragWithoutSelect?: boolean;
  instantEdit?: boolean;
}

export class EditMode implements DrawMode {
  name = "edit";

  public startSelectedId?: string | number;
  public dragWithoutSelect = false;
  public instantEdit = false;

  private _dragging = false;
  private _dragType: "feature" | "handle" | null = null;
  private _dragStartCoord?: Position;
  private _dragFeatureId?: string | number;
  private _dragHandleIndex?: number;

  constructor({ selectedId, dragWithoutSelect, instantEdit }: EditModeOptions = {}) {
    this.startSelectedId = selectedId;
    this.instantEdit = !!instantEdit;
    if (dragWithoutSelect) this.dragWithoutSelect = dragWithoutSelect;
  }

  onEnter(draw: DrawController) {
    draw.setCursor({ default: "default", hover: "pointer" });
    if (this.startSelectedId) {
      // Resolve to primary feature for grouped features
      const primaryFeature = getPrimaryFeature(draw.state, this.startSelectedId);
      const idToSelect = primaryFeature?.id ?? this.startSelectedId;
      draw.state.setSelected(idToSelect);
    }
    this.createHandles(draw);
  }

  onExit(draw: DrawController) {
    this.startSelectedId = undefined;
    this.deselectAll(draw);
    this.resetDragState();
  }

  onClick(info: DrawInfo, draw: DrawController) {
    this.deselectAll(draw);

    const f = info.feature;
    if (!f || !f.id) return;

    const { handle, midpoint, insertIndex } = f.properties || {};
    if (handle) return;

    if (midpoint) {
      const selected = this.getSelectedFeature(draw);
      if (!selected) return;
      this.insertVertex(draw, insertIndex, [info.lng, info.lat]);
      this.createHandles(draw);
      return;
    }

    // Resolve to primary feature for grouped features
    const primaryFeature = getPrimaryFeature(draw.state, f.id);
    const primaryId = primaryFeature?.id ?? f.id;

    if (this.instantEdit) {
      draw.state.setSelected(primaryId);
      this.createHandles(draw);
    } else if (!draw.state.isSelected(primaryId)) {
      draw.changeMode<SelectMode>("select", { startSelectedId: primaryId });
    }
  }

  onMouseDown(info: DrawInfo, draw: DrawController) {
    const f = info.feature;
    if (!f || !f.id) return draw.setDoubleClickZoom(true);

    const { handle, midpoint, index } = (f.properties as HandleFeatureProperties) || {};

    // Resolve to primary feature for grouped features
    const primaryFeature = getPrimaryFeature(draw.state, f.id);
    const primaryId = primaryFeature?.id ?? f.id;

    if (this.dragWithoutSelect || draw.state.isSelected(primaryId)) {
      if (!handle && !midpoint) {
        this._dragging = true;
        this._dragFeatureId = primaryId;
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
      this.insertVertex(draw, index, [info.lng, info.lat]);
      this.startDrag("handle", info, index + 1, draw);
      this.createHandles(draw);
      return;
    }

    if (handle) return this.startDrag("handle", info, index, draw);
    if (draw.state.isSelected(primaryId)) this.startDrag("feature", info, undefined, draw);
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (this._dragging && this._dragFeatureId && this._dragStartCoord && this._dragType === "feature") {
      const feature = draw.state.getFeature(this._dragFeatureId);
      if (!feature || !feature.id) return;

      const [dx, dy] = [info.lng - this._dragStartCoord[0], info.lat - this._dragStartCoord[1]];
      this.translateFeature(feature, dx, dy, draw);

      this._dragStartCoord = [info.lng, info.lat];
      this.updateHandles(draw);
      return;
    }

    const selected = this.getSelectedFeature(draw);
    if (!this._dragging || !selected?.id || !this._dragStartCoord) return;

    const [dx, dy] = [info.lng - this._dragStartCoord[0], info.lat - this._dragStartCoord[1]];
    this._dragStartCoord = [info.lng, info.lat];

    if (this._dragType === "handle" && typeof this._dragHandleIndex === "number") {
      this.editHandle(selected, this._dragHandleIndex, dx, dy, draw);
      this.updateHandles(draw);
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

  private translateFeature(feature: Feature, dx: number, dy: number, draw: DrawController): void {
    const handles: Position[] = feature.properties?.handles || [];
    const moved = handles.map(([x, y]) => [x + dx, y + dy]);
    this.regenerateAndUpdate(draw, feature, moved);
  }

  private editHandle(feature: Feature, handleIndex: number, dx: number, dy: number, draw: DrawController): void {
    const handles: Position[] = feature.properties?.handles || [];
    const mode = draw.getMode(feature.properties?.mode);

    let newHandles: Position[];
    const context: EditContext = { handleIndex, handles, delta: [dx, dy] };

    if (mode?.edit) {
      newHandles = mode.edit(context);
    } else {
      // Default isolated editor behavior
      newHandles = handles.map((coord, i) => (i === handleIndex ? [coord[0] + dx, coord[1] + dy] : coord));
    }
    this.regenerateAndUpdate(draw, feature, newHandles);
  }

  private insertVertex(draw: DrawController, index: number, coord: Position) {
    const selected = this.getSelectedFeature(draw);
    if (!selected?.id) return;

    const handles = selected.properties?.handles || [];
    const updatedHandles = [...handles];
    updatedHandles.splice(index + 1, 0, coord);

    this.regenerateAndUpdate(draw, selected, updatedHandles);
  }

  private createHandles(draw: DrawController) {
    const selected = this.getSelectedFeature(draw);
    if (!selected?.id) return;
    draw.state.clearHandles(selected.id);

    const coords: Position[] = selected.properties?.handles || [];
    coords.map((c, i) => draw.state.createHandle(selected.id!, c, i));

    if (selected.properties?.insertable !== false) {
      this.makeMidpoints(coords, selected.geometry.type === "Polygon", draw);
    }
  }

  private updateHandles(draw: DrawController) {
    const selected = this.getSelectedFeature(draw);
    if (!selected?.id) return;

    const coords: Position[] = selected.properties?.handles || [];
    const existingHandles = draw.state.getHandles(selected.id);

    // Separate handles and midpoints
    const handles = existingHandles.filter((h) => h.properties.handle);
    const midpoints = existingHandles.filter((h) => h.properties.midpoint);

    // Update handle positions
    handles.forEach((handle, i) => {
      if (i < coords.length && handle.id) {
        draw.state.updateHandle(handle.id, coords[i]);
      }
    });

    // Update midpoint positions
    if (selected.properties?.insertable !== false) {
      this.updateMidpoints(coords, selected.geometry.type === "Polygon", midpoints, draw);
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

  private makeMidpoint(a: Position, b: Position, i: number, draw: DrawController) {
    const ma = toMercator(point(a)).geometry.coordinates;
    const mb = toMercator(point(b)).geometry.coordinates;
    const mid = toWgs84(point([(ma[0] + mb[0]) / 2, (ma[1] + mb[1]) / 2])).geometry.coordinates;
    draw.state.createHandle(this.getSelectedFeature(draw)!.id!, mid, i, true);
  }

  private updateMidpoints(
    coords: Position[],
    isPolygon: boolean,
    existingMidpoints: HandleFeature[],
    draw: DrawController,
  ) {
    let midpointIndex = 0;

    for (let i = 0; i < coords.length - 1; i++) {
      const mid = this.calculateMidpoint(coords[i], coords[i + 1]);
      const midpointId = existingMidpoints[midpointIndex]?.id;
      if (midpointId !== undefined) {
        draw.state.updateHandle(midpointId, mid);
        midpointIndex++;
      }
    }

    if (isPolygon && coords.length > 2) {
      const mid = this.calculateMidpoint(coords[coords.length - 1], coords[0]);
      const midpointId = existingMidpoints[midpointIndex]?.id;
      if (midpointId !== undefined) {
        draw.state.updateHandle(midpointId, mid);
      }
    }
  }

  private calculateMidpoint(a: Position, b: Position): Position {
    const ma = toMercator(point(a)).geometry.coordinates;
    const mb = toMercator(point(b)).geometry.coordinates;
    return toWgs84(point([(ma[0] + mb[0]) / 2, (ma[1] + mb[1]) / 2])).geometry.coordinates;
  }

  private deselectAll(draw: DrawController) {
    const selected = this.getSelectedFeature(draw);
    if (selected?.id) draw.state.clearHandles(selected.id);
    draw.state.clearSelection();
  }

  private getSelectedFeature(draw: DrawController): Feature | undefined {
    const id = draw.state.selectedIds[0];
    if (!id) return;
    return draw.state.getFeature(id);
  }

  // === Core helper ===
  private regenerateAndUpdate(draw: DrawController, feature: Feature, coords: Position[]): void {
    if (!feature.id) return;

    const modeName = feature.properties?.mode;
    const props = { ...feature.properties, handles: coords };

    if (modeName) {
      const mode = draw.getMode(modeName);
      if (mode) {
        // Get all features in the group
        const groupIds = getGroupIds(draw.state, feature.id);
        // Pass single ID for backward compatibility, or array for grouped features
        const idArg = groupIds.length === 1 ? groupIds[0] : groupIds;
        const result = mode.generate?.(draw, coords, idArg, props);

        if (result) {
          const features = Array.isArray(result) ? result : [result];
          features.forEach(f => {
            if (f.id !== undefined) {
              draw.state.updateFeature(f.id, f);
            }
          });
          return;
        }
      }
    }

    // Fallback: update just this feature
    const updated = {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: feature.geometry.type === "Point" ? coords[0] : coords,
      },
      properties: props,
    } as Feature;

    draw.state.updateFeature(feature.id, updated);
  }
}
