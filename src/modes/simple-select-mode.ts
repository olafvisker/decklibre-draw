import type { Feature, Position } from "geojson";
import { DirectSelectMode } from "./direct-select-mode";
import { DrawController, DrawInfo, DrawMode } from "../core";

interface SimpleSelectModeOptions {
  selectedId?: string | number;
  dragWithoutSelect?: boolean;
}

export class SimpleSelectMode implements DrawMode {
  private _startSelectedId: string | number | undefined;
  private _dragging = false;
  private _dragWithoutSelect = false;
  private _dragStartCoord?: [number, number];
  private _dragFeatureId?: string | number;

  constructor({ selectedId, dragWithoutSelect }: SimpleSelectModeOptions = {}) {
    if (dragWithoutSelect) this._dragWithoutSelect = dragWithoutSelect;
    this._startSelectedId = selectedId;
  }

  onEnter(draw: DrawController) {
    draw.setCursor({ default: "default", hover: "pointer" });
    if (this._startSelectedId) draw.store.setSelected(this._startSelectedId);
  }

  onExit(draw: DrawController) {
    this._dragging = false;
    this._dragStartCoord = undefined;
    this._dragFeatureId = undefined;
    draw.setDraggability(true);
    draw.store.clearSelection();
  }

  onClick(info: DrawInfo, draw: DrawController) {
    const feature = info.feature as Feature | undefined;
    if (!feature?.id) {
      draw.store.clearSelection();
      return;
    }

    if (draw.store.isSelected(feature.id)) {
      draw.changeMode(DirectSelectMode, { selectedId: feature.id });
    } else {
      draw.store.setSelected(feature.id);
    }
  }

  onMouseDown(info: DrawInfo, draw: DrawController) {
    const featureId = info.feature?.id;
    if (!featureId) return;

    if (this._dragWithoutSelect || draw.store.isSelected(featureId)) {
      this._dragging = true;
      this._dragFeatureId = featureId;
      this._dragStartCoord = [info.lng, info.lat];
      draw.setDraggability(false);
    }
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (!this._dragging || !this._dragFeatureId || !this._dragStartCoord) return;

    const [dx, dy] = [info.lng - this._dragStartCoord[0], info.lat - this._dragStartCoord[1]];
    const feature = draw.store.getFeature(this._dragFeatureId);
    if (feature) {
      draw.store.updateFeature(this._dragFeatureId, this.translateFeature(feature, dx, dy));
    }

    this._dragStartCoord = [info.lng, info.lat];
  }

  onMouseUp(_info: DrawInfo, draw: DrawController) {
    this._dragging = false;
    this._dragStartCoord = undefined;
    this._dragFeatureId = undefined;
    draw.setDraggability(true);
  }

  private translateFeature(f: Feature, dx: number, dy: number): Feature {
    if (!f.geometry) return f;

    const translate = ([x, y, ...rest]: Position): Position => [x + dx, y + dy, ...rest];
    const geom = f.geometry;

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
        return f;
    }

    const newHandles = (f.properties?.handles as Position[]).map(([x, y]) => [x + dx, y + dy]);

    return {
      ...f,
      geometry: newGeom,
      properties: { ...f.properties, handles: newHandles },
    };
  }
}
