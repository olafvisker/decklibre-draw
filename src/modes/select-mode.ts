import type { Position } from "geojson";
import { DrawController } from "../core";
import type { DrawInfo, DrawMode } from "../core";
import { EditMode } from "./edit-mode";

interface SelectModeOptions {
  selectedId?: string | number;
  dragWithoutSelect?: boolean;
  preventEdit?: boolean;
}

export class SelectMode implements DrawMode {
  readonly name = "select";

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
    if (this.startSelectedId) draw.state.setSelected(this.startSelectedId);
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

    if (!this.preventEdit && draw.state.isSelected(f.id)) {
      draw.changeMode<EditMode>("edit", { startSelectedId: f.id });
    } else {
      draw.state.setSelected(f.id);
    }
  }

  onMouseDown(info: DrawInfo, draw: DrawController) {
    const featureId = info.feature?.id;
    if (!featureId) return;

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

    const feature = draw.state.getFeature(this._dragFeatureId);
    if (!feature || !feature.id) return;

    const handles: Position[] = feature.properties?.handles || [];

    const mode = draw.getMode(feature.properties?.mode);
    if (mode) {
      const movedHandles = handles.map(([x, y]) => [x + dx, y + dy]);
      const updated = mode.generate?.(draw, movedHandles, feature.id, { ...feature.properties, handles: movedHandles });
      if (updated) draw.state.updateFeature(feature.id, updated);
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
