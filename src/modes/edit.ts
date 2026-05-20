import type { DrawInfo, ControlPointFeatureProperties, EditContext, ControlPointFeature } from "../core";
import type { DrawMode } from "../core";
import { DrawController } from "../core";
import type { Feature, Position } from "geojson";
import { toMercator, toWgs84, point } from "@turf/turf";
import { SelectMode } from "./select";
import type { MapMouseEvent, MapTouchEvent } from "maplibre-gl";

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
  private _dragType: "feature" | "controlPoint" | null = null;
  private _dragStartCoord?: Position;
  private _dragFeatureId?: string | number;
  private _dragControlPointIndex?: number;

  constructor({ selectedId, dragWithoutSelect, instantEdit }: EditModeOptions = {}) {
    this.startSelectedId = selectedId;
    this.instantEdit = !!instantEdit;
    if (dragWithoutSelect) this.dragWithoutSelect = dragWithoutSelect;
  }

  onEnter(draw: DrawController) {
    draw.setCursor({ default: "default", hover: "pointer" });
    if (this.startSelectedId) {
      // Resolve to primary feature for grouped features
      const primaryFeature = draw.state.getPrimaryFeature( this.startSelectedId);
      const idToSelect = primaryFeature?.id ?? this.startSelectedId;
      draw.state.setSelected(idToSelect);
    }
    this.createControlPoints(draw);
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

    const { controlPoint, midpoint, insertIndex } = f.properties || {};
    if (controlPoint) return;

    if (midpoint) {
      const selected = this.getSelectedFeature(draw);
      if (!selected) return;
      this.insertVertex(draw, insertIndex, [info.lng, info.lat]);
      this.createControlPoints(draw);
      return;
    }

    // Resolve to primary feature for grouped features
    const primaryFeature = draw.state.getPrimaryFeature( f.id);
    const primaryId = primaryFeature?.id ?? f.id;

    if (this.instantEdit) {
      draw.state.setSelected(primaryId);
      this.createControlPoints(draw);
    } else if (!draw.state.isSelected(primaryId)) {
      draw.changeMode<SelectMode>("select", { startSelectedId: primaryId });
    }
  }

  onMouseDown(info: DrawInfo, draw: DrawController) {
    const f = info.feature;
    if (!f || !f.id) return draw.setDoubleClickZoom(true);

    const { controlPoint, midpoint, index } = (f.properties as ControlPointFeatureProperties) || {};

    // Resolve to primary feature for grouped features
    const primaryFeature = draw.state.getPrimaryFeature( f.id);
    const primaryId = primaryFeature?.id ?? f.id;

    if (this.dragWithoutSelect || draw.state.isSelected(primaryId)) {
      if (!controlPoint && !midpoint) {
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
      this.startDrag("controlPoint", info, index + 1, draw);
      this.createControlPoints(draw);
      return;
    }

    if (controlPoint) return this.startDrag("controlPoint", info, index, draw);
    if (draw.state.isSelected(primaryId)) this.startDrag("feature", info, undefined, draw);
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (this._dragging && this._dragFeatureId && this._dragStartCoord && this._dragType === "feature") {
      const feature = draw.state.getFeature(this._dragFeatureId);
      if (!feature || !feature.id) return;

      const [dx, dy] = [info.lng - this._dragStartCoord[0], info.lat - this._dragStartCoord[1]];
      this.translateFeature(feature, dx, dy, draw);

      this._dragStartCoord = [info.lng, info.lat];
      this.updateControlPoints(draw);
      return;
    }

    const selected = this.getSelectedFeature(draw);
    if (!this._dragging || !selected?.id || !this._dragStartCoord) return;

    const [dx, dy] = [info.lng - this._dragStartCoord[0], info.lat - this._dragStartCoord[1]];
    this._dragStartCoord = [info.lng, info.lat];

    if (this._dragType === "controlPoint" && typeof this._dragControlPointIndex === "number") {
      this.editControlPoint(selected, this._dragControlPointIndex, dx, dy, draw);
      this.updateControlPoints(draw);
    }
  }

  onMouseUp(info: DrawInfo, draw: DrawController) {
    this.resetDragState();
    this._dragFeatureId = undefined;
    draw.setPanning(true);

    if (!info.feature || (!info.feature.properties?.controlPoint && !info.feature.properties?.midpoint)) {
      draw.setDoubleClickZoom(true);
    }
  }

  onDoubleClick(info: DrawInfo, _draw: DrawController, event: MapMouseEvent | MapTouchEvent) {
    // Prevent zoom when double-clicking features or control points
    if (info.feature?.id) {
      event.preventDefault();
    }
  }

  private resetDragState() {
    this._dragging = false;
    this._dragType = null;
    this._dragStartCoord = undefined;
    this._dragControlPointIndex = undefined;
  }

  private startDrag(type: "feature" | "controlPoint", info: DrawInfo, controlPointIndex: number | undefined, draw: DrawController) {
    this._dragging = true;
    this._dragType = type;
    this._dragStartCoord = [info.lng, info.lat];
    this._dragControlPointIndex = controlPointIndex;
    draw.setPanning(false);
    draw.setDoubleClickZoom(false);
  }

  private translateFeature(feature: Feature, dx: number, dy: number, draw: DrawController): void {
    if (!feature.id) return;
    const controlPoints = draw.state.getControlPoints(feature.id) || [];
    const moved = controlPoints.map(([x, y]) => [x + dx, y + dy]);
    this.regenerateAndUpdate(draw, feature, moved);
  }

  private editControlPoint(feature: Feature, controlPointIndex: number, dx: number, dy: number, draw: DrawController): void {
    if (!feature.id) return;
    const controlPoints = draw.state.getControlPoints(feature.id) || [];
    const mode = draw.getMode(feature.properties?.mode);

    let newControlPoints: Position[];
    const context: EditContext = { controlPointIndex, controlPoints, delta: [dx, dy] };

    if (mode?.edit) {
      newControlPoints = mode.edit(context);
    } else {
      // Default isolated editor behavior
      newControlPoints = controlPoints.map((coord, i) => (i === controlPointIndex ? [coord[0] + dx, coord[1] + dy] : coord));
    }
    this.regenerateAndUpdate(draw, feature, newControlPoints);
  }

  private insertVertex(draw: DrawController, index: number, coord: Position) {
    const selected = this.getSelectedFeature(draw);
    if (!selected?.id) return;

    const controlPoints = draw.state.getControlPoints(selected.id) || [];
    const updatedControlPoints = [...controlPoints];
    updatedControlPoints.splice(index + 1, 0, coord);

    this.regenerateAndUpdate(draw, selected, updatedControlPoints);
  }

  private createControlPoints(draw: DrawController) {
    const selected = this.getSelectedFeature(draw);
    if (!selected?.id) return;
    draw.state.clearControlPoints(selected.id);

    const coords = draw.state.getControlPoints(selected.id) || [];
    coords.forEach((c, i) => draw.state.createControlPoint(selected.id!, c, i));

    if (selected.properties?.insertable !== false) {
      this.makeMidpoints(coords, selected.geometry.type === "Polygon", draw);
    }
  }

  private updateControlPoints(draw: DrawController) {
    const selected = this.getSelectedFeature(draw);
    if (!selected?.id) return;

    const coords = draw.state.getControlPoints(selected.id) || [];
    const existingControlPointFeatures = draw.state.getControlPointFeatures(selected.id);

    // Separate control points and midpoints
    const controlPointFeatures = existingControlPointFeatures.filter((cp) => cp.properties.controlPoint);
    const midpoints = existingControlPointFeatures.filter((cp) => cp.properties.midpoint);

    // Update control point positions
    controlPointFeatures.forEach((controlPoint, i) => {
      if (i < coords.length && controlPoint.id) {
        draw.state.updateControlPoint(controlPoint.id, coords[i]);
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
    draw.state.createControlPoint(this.getSelectedFeature(draw)!.id!, mid, i, true);
  }

  private updateMidpoints(
    coords: Position[],
    isPolygon: boolean,
    existingMidpoints: ControlPointFeature[],
    draw: DrawController,
  ) {
    let midpointIndex = 0;

    for (let i = 0; i < coords.length - 1; i++) {
      const mid = this.calculateMidpoint(coords[i], coords[i + 1]);
      const midpointId = existingMidpoints[midpointIndex]?.id;
      if (midpointId !== undefined) {
        draw.state.updateControlPoint(midpointId, mid);
        midpointIndex++;
      }
    }

    if (isPolygon && coords.length > 2) {
      const mid = this.calculateMidpoint(coords[coords.length - 1], coords[0]);
      const midpointId = existingMidpoints[midpointIndex]?.id;
      if (midpointId !== undefined) {
        draw.state.updateControlPoint(midpointId, mid);
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
    if (selected?.id) draw.state.clearControlPoints(selected.id);
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

    // Update control points in state
    draw.state.setControlPoints(feature.id, coords);

    const modeName = feature.properties?.mode;
    const props = { ...feature.properties };

    if (modeName) {
      const mode = draw.getMode(modeName);
      if (mode?.generate) {
        // Get all features in the group
        const groupIds = draw.state.getGroupIds( feature.id);
        const features = mode.generate(draw, coords, groupIds, props);

        features.forEach(f => {
          if (f.id !== undefined) {
            draw.state.updateFeature(f.id, f);
          }
        });
        return;
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
