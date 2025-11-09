import type { Position } from "geojson";
import { DrawController, DrawInfo, DrawMode } from "../core";
import { EditMode } from "./edit-mode";

interface SelectModeOptions {
  selectedId?: string | number;
  dragWithoutSelect?: boolean;
}

export class SelectMode implements DrawMode {
  public startSelectedId: string | number | undefined;
  public dragWithoutSelect = false;

  private _dragging = false;
  private _dragStartCoord?: Position;
  private _dragFeatureId?: string | number;

  constructor({ selectedId, dragWithoutSelect }: SelectModeOptions = {}) {
    this.startSelectedId = selectedId;
    if (dragWithoutSelect) this.dragWithoutSelect = dragWithoutSelect;
  }

  onEnter(draw: DrawController) {
    draw.setCursor({ default: "default", hover: "pointer" });
    if (this.startSelectedId) draw.store.setSelected(this.startSelectedId);
  }

  onExit(draw: DrawController) {
    this._dragging = false;
    this._dragStartCoord = undefined;
    this._dragFeatureId = undefined;
    draw.setDraggability(true);
    draw.store.clearSelection();
  }

  onClick(info: DrawInfo, draw: DrawController) {
    const feature = info.feature;
    if (!feature?.id) {
      draw.store.clearSelection();
      return;
    }

    if (draw.store.isSelected(feature.id)) {
      draw.changeMode<EditMode>("edit", { startSelectedId: feature.id });
    } else {
      draw.store.setSelected(feature.id);
    }
  }

  onMouseDown(info: DrawInfo, draw: DrawController) {
    const featureId = info.feature?.id;
    if (!featureId) return;

    if (this.dragWithoutSelect || draw.store.isSelected(featureId)) {
      this._dragging = true;
      this._dragFeatureId = featureId;
      this._dragStartCoord = [info.lng, info.lat];
      draw.setDraggability(false);
    }
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (!this._dragging || !this._dragFeatureId || !this._dragStartCoord) return;

    const dx = info.lng - this._dragStartCoord[0];
    const dy = info.lat - this._dragStartCoord[1];

    const feature = draw.store.getFeature(this._dragFeatureId);
    if (!feature) return;

    const handles: Position[] = feature.properties?.handles || [];

    if (feature.properties?.generator && handles.length > 0) {
      // Regenerate feature via generator
      const movedHandles = handles.map(([x, y]) => [x + dx, y + dy]);

      const updated = draw.store.generateFeature(feature.properties.generator, movedHandles, {
        id: feature.id,
        props: { ...feature.properties, handles: movedHandles },
      });
      if (updated) draw.store.updateFeature(feature.id, updated);
    } else {
      // Fallback: simple coordinate translation
      const translate = ([x, y, ...rest]: Position): Position => [x + dx, y + dy, ...rest];
      const geom = feature.geometry;
      let newGeom: typeof geom;

      switch (geom.type) {
        case "Point":
          newGeom = { ...geom, coordinates: translate(geom.coordinates) };
          break;
        case "LineString":
          newGeom = { ...geom, coordinates: geom.coordinates.map(translate) };
          break;
        case "Polygon":
          newGeom = { ...geom, coordinates: geom.coordinates.map((ring) => ring.map(translate)) };
          break;
        default:
          newGeom = geom;
      }

      draw.store.updateFeature(feature.id, {
        ...feature,
        geometry: newGeom,
      });
    }

    this._dragStartCoord = [info.lng, info.lat];
  }

  onMouseUp(_info: DrawInfo, draw: DrawController) {
    this._dragging = false;
    this._dragStartCoord = undefined;
    this._dragFeatureId = undefined;
    draw.setDraggability(true);
  }
}
