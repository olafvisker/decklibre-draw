import type { Position } from "geojson";
import { DrawController } from "../core";
import type { DrawInfo, DrawMode } from "../core";
import { EditMode } from "./edit";

interface SelectModeOptions {
  selectedId?: string | number;
  dragWithoutSelect?: boolean;
  preventEdit?: boolean;
}

export class SelectMode implements DrawMode {
  name = "select";

  public startSelectedId?: string | number;
  public dragWithoutSelect = false;
  public preventEdit = false;

  private _dragging = false;
  private _dragStartCoord?: Position;
  private _dragFeatureId?: string | number;

  constructor({ selectedId, dragWithoutSelect, preventEdit }: SelectModeOptions = {}) {
    this.startSelectedId = selectedId;
    this.preventEdit = !!preventEdit;
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
  }

  onExit(draw: DrawController) {
    this.startSelectedId = undefined;
    this._dragging = false;
    this._dragStartCoord = undefined;
    this._dragFeatureId = undefined;
    draw.setPanning(true);
    draw.state.clearSelection();
  }

  onClick(info: DrawInfo, draw: DrawController) {
    const f = info.feature;
    if (!f?.id) {
      draw.state.clearSelection();
      return;
    }

    // For grouped features, always use the primary feature ID
    const primaryFeature = draw.state.getPrimaryFeature( f.id);
    const idToSelect = primaryFeature?.id ?? f.id;

    if (!this.preventEdit && draw.state.isSelected(idToSelect)) {
      draw.changeMode<EditMode>("edit", { startSelectedId: idToSelect });
    } else {
      draw.state.setSelected(idToSelect);
    }
  }

  onMouseDown(info: DrawInfo, draw: DrawController) {
    const feature = info.feature;
    if (!feature?.id) return;

    // For grouped features, use the primary feature ID for dragging
    const primaryFeature = draw.state.getPrimaryFeature( feature.id);
    const featureId = primaryFeature?.id ?? feature.id;

    // Allow drag if dragWithoutSelect is enabled OR if primary feature is selected
    if (this.dragWithoutSelect || draw.state.isSelected(featureId)) {
      this._dragging = true;
      this._dragFeatureId = featureId;
      this._dragStartCoord = [info.lng, info.lat];
      draw.setPanning(false);
    }
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (!this._dragging || !this._dragFeatureId || !this._dragStartCoord) return;

    const dx = info.lng - this._dragStartCoord[0];
    const dy = info.lat - this._dragStartCoord[1];

    // Get all features in the group
    const groupIds = draw.state.getGroupIds( this._dragFeatureId);
    const primaryFeature = draw.state.getPrimaryFeature( this._dragFeatureId);

    if (!primaryFeature || !primaryFeature.id || !primaryFeature.properties?.mode) return;

    const controlPoints = draw.state.getControlPoints(primaryFeature.id) || [];
    const mode = draw.getMode(primaryFeature.properties.mode);

    if (mode?.generate) {
      const movedControlPoints = controlPoints.map(([x, y]) => [x + dx, y + dy]);

      // Update control points in state
      draw.state.setControlPoints(primaryFeature.id, movedControlPoints);

      const features = mode.generate(draw, movedControlPoints, groupIds, primaryFeature.properties);

      features.forEach(feature => {
        if (feature.id !== undefined) {
          draw.state.updateFeature(feature.id, feature);
        }
      });
    }

    this._dragStartCoord = [info.lng, info.lat];
  }

  onMouseUp(_info: DrawInfo, draw: DrawController) {
    this._dragging = false;
    this._dragStartCoord = undefined;
    this._dragFeatureId = undefined;
    draw.setPanning(true);
  }
}
