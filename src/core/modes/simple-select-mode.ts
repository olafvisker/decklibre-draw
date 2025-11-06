import type { Feature, Position } from "geojson";
import { DirectSelectMode } from "./direct-select-mode";
import type { DrawController } from "../draw-controller";
import type { DrawInfo, DrawMode } from "../draw-mode";

interface SimpleSelectModeOptions {
  activeFeatureId?: string | number;
  dragWithoutSelect?: boolean;
}

export class SimpleSelectMode implements DrawMode {
  private _activeFeatureId?: string | number;
  private _dragging = false;
  private _dragStartCoord?: [number, number];
  private _dragFeatureId?: string | number;
  private _dragWithoutSelect: boolean;

  constructor({ activeFeatureId, dragWithoutSelect = false }: SimpleSelectModeOptions = {}) {
    this._activeFeatureId = activeFeatureId;
    this._dragWithoutSelect = dragWithoutSelect;
  }

  onEnter(draw: DrawController) {
    draw.setCursor({ default: "default", hover: "pointer" });
    this.setActive(draw, this._activeFeatureId);
  }

  onExit(draw: DrawController) {
    this._dragging = false;
    this._dragStartCoord = undefined;
    this._dragFeatureId = undefined;
    draw.setDraggability(true);
  }

  onClick(info: DrawInfo, draw: DrawController) {
    const feature = info.feature as Feature | undefined;
    if (!feature?.id) {
      this.clearActive(draw);
      return;
    }

    if (feature.id !== this._activeFeatureId) {
      this.setActive(draw, feature.id);
    } else {
      draw.changeMode(new DirectSelectMode({ activeFeatureId: feature.id }));
    }
  }

  onMouseDown(info: DrawInfo, draw: DrawController) {
    const featureId = info.feature?.id;
    if (!featureId) return;

    if (this._dragWithoutSelect || featureId === this._activeFeatureId) {
      this._dragging = true;
      this._dragFeatureId = featureId;
      this._dragStartCoord = [info.lng, info.lat];
      draw.setDraggability(false);
    }
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (!this._dragging || !this._dragFeatureId || !this._dragStartCoord) return;

    const [dx, dy] = [info.lng - this._dragStartCoord[0], info.lat - this._dragStartCoord[1]];
    const feature = draw.features.find((f) => f.id === this._dragFeatureId);
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

  private setActive(draw: DrawController, id: string | number | undefined) {
    this.clearActive(draw);
    this._activeFeatureId = id;
    draw.store.updateFeature(id, { properties: { active: true } });
  }

  private clearActive(draw: DrawController) {
    this._activeFeatureId = undefined;
    draw.features.forEach((f) => draw.store.updateFeature(f.id, { properties: { active: false } }));
  }

  private translateFeature(f: Feature, dx: number, dy: number): Feature {
    if (!f.geometry) return f;

    const translate = ([x, y, ...rest]: Position): Position => [x + dx, y + dy, ...rest];
    const geom = f.geometry;

    // 1️⃣ translate geometry
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
