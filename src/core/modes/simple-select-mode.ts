import type { Feature, Position } from "geojson";
import { DirectSelectMode } from "./direct-select-mode";
import type { DrawController, DrawInfo } from "../draw-controller";
import type { DrawMode } from "../draw-mode";

export class SimpleSelectMode implements DrawMode {
  private _activeFeatureId?: string | number;
  private _dragging = false;
  private _dragStartCoord?: [number, number];

  constructor(activeFeatureId?: string | number) {
    this._activeFeatureId = activeFeatureId;
  }

  onEnter(draw: DrawController) {
    draw.setCursor({ default: "default", hover: "pointer" });
    this.setActive(draw, this._activeFeatureId);
  }

  onExit(draw: DrawController) {
    this.clearActive(draw);
    draw.setDraggability(true);
  }

  onClick(info: DrawInfo, draw: DrawController) {
    const feature = info.feature as Feature | undefined;

    if (!feature || !feature.id) {
      this.clearActive(draw);
      return;
    }

    if (feature.id !== this._activeFeatureId) {
      this.setActive(draw, feature.id);
    } else {
      draw.changeMode(new DirectSelectMode(feature.id));
    }
  }

  onMouseDown(info: DrawInfo, draw: DrawController) {
    if (!this._activeFeatureId) return;

    const feature = info.feature as Feature | undefined;
    if (!feature || feature.id !== this._activeFeatureId) return;

    this._dragging = true;
    this._dragStartCoord = [info.lng, info.lat];
    draw.setDraggability(false);
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (!this._dragging || !this._activeFeatureId || !this._dragStartCoord) return;
    const [dx, dy] = [info.lng - this._dragStartCoord[0], info.lat - this._dragStartCoord[1]];

    const feature = draw.features.find((f) => f.id === this._activeFeatureId);
    if (feature) {
      const updated = this.translateFeature(feature, dx, dy);
      draw.updateFeature(this._activeFeatureId, updated);
    }
    this._dragStartCoord = [info.lng, info.lat];
  }

  onMouseUp(_info: DrawInfo, draw: DrawController) {
    this._dragging = false;
    this._dragStartCoord = undefined;
    draw.setDraggability(true);
  }

  private setActive(draw: DrawController, id: string | number | undefined) {
    this.clearActive(draw);
    this._activeFeatureId = id;
    draw.updateFeature(id, { properties: { active: true } });
  }

  private clearActive(draw: DrawController) {
    this._activeFeatureId = undefined;
    draw.features.forEach((f) => {
      draw.updateFeature(f.id, { properties: { active: false } });
    });
  }

  private translateFeature(f: Feature, dx: number, dy: number): Feature {
    const translatePair = (pair: Position): Position => {
      const [lng, lat, ...rest] = pair;
      return [lng + dx, lat + dy, ...rest];
    };

    const translateCoords = (coords: Position | Position[] | Position[][] | Position[][][]): any => {
      if (Array.isArray(coords[0])) {
        return coords.map((c) => translateCoords(c));
      }
      return translatePair(coords as Position);
    };

    const geometry: Geometry = f.geometry;
    const newGeometry: Geometry =
      geometry && "coordinates" in geometry
        ? {
            ...geometry,
            coordinates: translateCoords((geometry as any).coordinates),
          }
        : geometry;

    // translate _vertices if present and looks like array of positions
    const props = { ...(f.properties || {}) };
    if (Array.isArray(props._vertices)) {
      props._vertices = props._vertices.map((v: unknown) => {
        if (Array.isArray(v) && typeof v[0] === "number" && typeof v[1] === "number") {
          return translatePair(v as Position);
        }
        return v;
      });
    }

    return {
      ...f,
      geometry: newGeometry,
      properties: props,
    };
  }

  // private translateFeature(f: Feature, dx: number, dy: number): Feature {
  //   switch (f.geometry.type) {
  //     case "Point": {
  //       const [lng, lat] = f.geometry.coordinates;
  //       const coords = [lng + dx, lat + dy];
  //       return {
  //         ...f,
  //         geometry: { ...f.geometry, coordinates: coords },
  //         properties: { ...f.properties, _vertices: coords },
  //       };
  //     }
  //     case "LineString": {
  //       const coords = f.geometry.coordinates.map(([lng, lat]) => [lng + dx, lat + dy]);
  //       return {
  //         ...f,
  //         geometry: { ...f.geometry, coordinates: coords },
  //         properties: { ...f.properties, _vertices: coords },
  //       };
  //     }
  //     case "Polygon": {
  //       const coords = f.geometry.coordinates[0].map(([lng, lat]) => [lng + dx, lat + dy]);
  //       return {
  //         ...f,
  //         geometry: { ...f.geometry, coordinates: [coords] },
  //         properties: { ...f.properties, _vertices: coords },
  //       };
  //     }
  //     default:
  //       return f;
  //   }
  // }
}
