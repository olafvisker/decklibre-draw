import type { DrawMode } from "../draw-mode";
import type { DrawController, DrawInfo } from "../draw-controller";
import type { Feature, Geometry, Point, Position } from "geojson";
import { v4 as uuid } from "uuid";
import { coordAll, point, toMercator, toWgs84 } from "@turf/turf";
import { SimpleSelectMode } from "./simple-select-mode";

export class DirectSelectMode implements DrawMode {
  private _activeFeatureId?: string | number;
  private _handleIds: (string | number)[] = [];
  private _dragging = false;
  private _dragType: "feature" | "handle" | null = null;
  private _dragStartCoord?: Position;
  private _dragHandleIndex?: number;

  constructor(activeFeatureId?: string | number) {
    this._activeFeatureId = activeFeatureId;
  }

  onEnter(draw: DrawController) {
    draw.setCursor({ default: "default", hover: "pointer" });
    this.setActive(draw, this._activeFeatureId);
  }

  onExit(draw: DrawController) {
    this.deselectAll(draw);
    this.resetDragState();
  }

  onClick(info: DrawInfo, draw: DrawController) {
    const f = info.feature;
    if (!f) return this.deselectAll(draw);

    const { handle, midpoint, insertIndex } = f.properties || {};
    if (handle) return;

    if (midpoint && this._activeFeatureId !== undefined) {
      this.insertVertex(draw, insertIndex, [info.lng, info.lat]);
      this.createHandles(draw);
      return;
    }

    if (f.id !== this._activeFeatureId) {
      draw.changeMode(new SimpleSelectMode(f.id));
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

    if (this._dragType === "feature") {
      const feature = draw.features.find((f) => f.id === this._activeFeatureId);
      if (feature) {
        const updated = this.translate(feature, dx, dy, draw);
        draw.updateFeature(this._activeFeatureId, updated);
      }
    } else if (this._dragType === "handle" && typeof this._dragHandleIndex === "number") {
      const feature = draw.features.find((f) => f.id === this._activeFeatureId);
      if (feature) {
        const updated = this.moveVertex(feature, this._dragHandleIndex, dx, dy, draw);
        draw.updateFeature(this._activeFeatureId, updated);
      }
    }

    this.createHandles(draw);
  }

  onMouseUp(info: DrawInfo, draw: DrawController) {
    this.resetDragState();
    draw.setDraggability(true);

    if (!info.feature || (!info.feature.properties?.handle && !info.feature.properties?.midpoint)) {
      draw.setDoubleClickZoom(true);
    }
  }

  // --- Drag Helpers ---
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

  // --- Feature Manipulation ---
  private translate(f: Feature, dx: number, dy: number, draw: DrawController): Feature {
    const vertices = this.getCoords(f).map(([x, y]) => [x + dx, y + dy] as Position);
    return this.regenerateFeature(draw, f, vertices);
  }

  // private moveVertex(f: Feature, i: number, dx: number, dy: number, draw: DrawController): Feature {
  //   const vertices = this.getCoords(f);
  //   vertices[i] = [vertices[i][0] + dx, vertices[i][1] + dy];

  //   return this.regenerateFeature(draw, f, vertices);
  // }

  private moveVertex(f: Feature, i: number, dx: number, dy: number): Feature {
    const coords = this.getCoords(f);
    coords[i] = [coords[i][0] + dx, coords[i][1] + dy];

    if (f.geometry.type === "Polygon") {
      if (i === 0) coords[coords.length - 1] = [...coords[0]];
      if (coords.length > 2) coords[coords.length - 1] = [...coords[0]];
    }

    return { ...f, geometry: this.setCoords(f, coords), properties: { ...f.properties } };
  }

  private insertVertex(draw: DrawController, index: number, coord: Position) {
    const feature = draw.features.find((f) => f.id === this._activeFeatureId);
    if (!feature) return;

    const vertices = this.getCoords(feature);
    vertices.splice(index + 1, 0, coord);

    if (feature.geometry.type === "Polygon") {
      if (index + 1 === 0) vertices[vertices.length - 1] = [...vertices[0]];
      if (vertices.length > 2) vertices[vertices.length - 1] = [...vertices[0]];
    }

    const updated = this.regenerateFeature(draw, feature, vertices);
    draw.updateFeature(this._activeFeatureId, updated);
  }

  // --- Handle Management ---
  private createHandles(draw: DrawController) {
    this.clearHandles(draw);
    if (!this._activeFeatureId) return;

    const feature = draw.features.find((f) => f.id === this._activeFeatureId);
    if (!feature) return;

    const coords = this.getCoords(feature, true);
    const vertexHandles = coords.map((c, i) => draw.createHandle(c, i));
    const midpointHandles = this.makeMidpoints(coords, feature.geometry.type === "Polygon");

    this._handleIds = [...vertexHandles, ...midpointHandles].map((h) => h.id!);
    draw.addFeatures([...vertexHandles, ...midpointHandles]);
  }

  private clearHandles(draw: DrawController) {
    if (!this._handleIds.length) return;
    draw.removeFeatures(this._handleIds);
    this._handleIds = [];
  }

  private makeMidpoints(coords: Position[], isPolygon: boolean): Feature<Point>[] {
    const midpoints: Feature<Point>[] = [];
    for (let i = 0; i < coords.length - 1; i++) midpoints.push(this.makeMidpoint(coords[i], coords[i + 1], i));
    if (isPolygon && coords.length > 2)
      midpoints.push(this.makeMidpoint(coords[coords.length - 1], coords[0], coords.length - 1));
    return midpoints;
  }

  private makeMidpoint(a: Position, b: Position, i: number): Feature<Point> {
    const ma = toMercator(point(a)).geometry.coordinates;
    const mb = toMercator(point(b)).geometry.coordinates;
    const mid = toWgs84(point([(ma[0] + mb[0]) / 2, (ma[1] + mb[1]) / 2])).geometry.coordinates;
    return {
      id: uuid(),
      type: "Feature",
      geometry: { type: "Point", coordinates: mid },
      properties: { handle: true, midpoint: true, insertIndex: i },
    };
  }

  // --- Selection ---
  private deselectAll(draw: DrawController) {
    this._activeFeatureId = undefined;
    this.clearHandles(draw);
    const activeFeature = draw.features.find((f) => f.properties?.active);
    if (activeFeature)
      draw.updateFeature(activeFeature.id, { properties: { ...activeFeature.properties, active: false } });
  }

  private setActive(draw: DrawController, id: string | number | undefined) {
    this._activeFeatureId = id;
    draw.features.forEach((f) => {
      draw.updateFeature(f.id, { properties: { ...f.properties, active: f.id === id } });
    });
    this.createHandles(draw);
  }

  // --- Coordinate Helpers ---
  private regenerateFeature(draw: DrawController, feature: Feature, vertices: Position[]): Feature {
    const transformType = feature.properties?.transform as string | undefined;

    if (transformType) {
      const regenerated = draw.generateFeature(transformType, vertices);
      return {
        ...regenerated,
        id: feature.id,
        properties: { ...feature.properties, _vertices: vertices },
      };
    }

    return {
      ...feature,
      geometry: this.setCoords(feature, vertices),
      properties: { ...feature.properties },
    };
  }

  private getCoords(f: Feature, excludeLastPolygon = false): Position[] {
    const vertices = f.properties?._vertices as Position[];
    if (vertices) return vertices;
    const coords = coordAll(f);
    return excludeLastPolygon && f.geometry.type === "Polygon" ? coords.slice(0, -1) : coords;
  }

  private setCoords(f: Feature, coords: Position[]): Geometry {
    switch (f.geometry.type) {
      case "Point":
        return { type: "Point", coordinates: coords[0] };
      case "LineString":
        return { type: "LineString", coordinates: coords };
      case "Polygon":
        return { type: "Polygon", coordinates: [coords] };
      default:
        throw new Error(`Unsupported geometry type: ${f.geometry.type}`);
    }
  }
}
// import type { DrawMode } from "../draw-mode";
// import type { DrawController, DrawInfo } from "../draw-controller";
// import type { Feature, Geometry, Point, Position } from "geojson";
// import { v4 as uuid } from "uuid";
// import { coordAll, point, toMercator, toWgs84 } from "@turf/turf";
// import { SimpleSelectMode } from "./simple-select-mode";

// export class DirectSelectMode implements DrawMode {
//   private _activeFeatureId?: string | number;
//   private _handleIds: (string | number)[] = [];
//   private _dragging = false;
//   private _dragType: "feature" | "handle" | null = null;
//   private _dragStartCoord?: Position;
//   private _dragHandleIndex?: number;

//   constructor(activeFeatureId?: string | number) {
//     this._activeFeatureId = activeFeatureId;
//   }

//   onEnter(draw: DrawController) {
//     draw.setCursor({ default: "default", hover: "pointer" });
//     this.setActive(draw, this._activeFeatureId);
//   }

//   onExit(draw: DrawController) {
//     this.deselectAll(draw);
//     this.resetDragState();
//   }

//   onClick(info: DrawInfo, draw: DrawController) {
//     const f = info.feature;
//     if (!f) return this.deselectAll(draw);

//     const { handle, midpoint, insertIndex } = f.properties || {};
//     if (handle) return;

//     if (midpoint && this._activeFeatureId !== undefined) {
//       this.insertVertex(draw, insertIndex, [info.lng, info.lat]);
//       this.createHandles(draw);
//       return;
//     }

//     if (f.id !== this._activeFeatureId) {
//       draw.changeMode(new SimpleSelectMode(f.id));
//     }
//   }

//   onMouseDown(info: DrawInfo, draw: DrawController) {
//     const f = info.feature;
//     if (!f) return draw.setDoubleClickZoom(true);

//     const { handle, midpoint, _handleIndex, insertIndex } = f.properties || {};

//     if (midpoint && this._activeFeatureId !== undefined) {
//       this.insertVertex(draw, insertIndex, [info.lng, info.lat]);
//       this.startDrag("handle", info, insertIndex + 1, draw);
//       this.createHandles(draw);
//       return;
//     }

//     if (handle) return this.startDrag("handle", info, _handleIndex, draw);
//     if (f.id === this._activeFeatureId) this.startDrag("feature", info, undefined, draw);
//   }

//   onMouseMove(info: DrawInfo, draw: DrawController) {
//     if (!this._dragging || !this._activeFeatureId || !this._dragStartCoord) return;

//     const [dx, dy] = [info.lng - this._dragStartCoord[0], info.lat - this._dragStartCoord[1]];
//     this._dragStartCoord = [info.lng, info.lat];

//     if (this._dragType === "feature") {
//       const feature = draw.features.find((f) => f.id === this._activeFeatureId);
//       if (feature) draw.updateFeature(this._activeFeatureId, this.translate(feature, dx, dy));
//     } else if (this._dragType === "handle" && typeof this._dragHandleIndex === "number") {
//       const feature = draw.features.find((f) => f.id === this._activeFeatureId);
//       if (feature) draw.updateFeature(this._activeFeatureId, this.moveVertex(feature, this._dragHandleIndex, dx, dy));
//     }

//     this.createHandles(draw);
//   }

//   onMouseUp(info: DrawInfo, draw: DrawController) {
//     this.resetDragState();
//     draw.setDraggability(true);

//     if (!info.feature || (!info.feature.properties?.handle && !info.feature.properties?.midpoint)) {
//       draw.setDoubleClickZoom(true);
//     }
//   }

//   // --- Drag Helpers ---
//   private resetDragState() {
//     this._dragging = false;
//     this._dragType = null;
//     this._dragStartCoord = undefined;
//     this._dragHandleIndex = undefined;
//   }

//   private startDrag(type: "feature" | "handle", info: DrawInfo, handleIndex: number | undefined, draw: DrawController) {
//     this._dragging = true;
//     this._dragType = type;
//     this._dragStartCoord = [info.lng, info.lat];
//     this._dragHandleIndex = handleIndex;
//     draw.setDraggability(false);
//     draw.setDoubleClickZoom(false);
//   }

//   // --- Feature Manipulation ---
//   private translate(f: Feature, dx: number, dy: number): Feature {
//     const coords = this.getCoords(f).map(([x, y]) => [x + dx, y + dy] as Position);
//     return { ...f, geometry: this.setCoords(f, coords), properties: { ...f.properties, _vertices: coords } };
//   }

//   private moveVertex(f: Feature, i: number, dx: number, dy: number): Feature {
//     const coords = this.getCoords(f);
//     coords[i] = [coords[i][0] + dx, coords[i][1] + dy];

//     if (f.geometry.type === "Polygon") {
//       if (i === 0) coords[coords.length - 1] = [...coords[0]];
//       if (coords.length > 2) coords[coords.length - 1] = [...coords[0]];
//     }

//     return { ...f, geometry: this.setCoords(f, coords), properties: { ...f.properties, _vertices: coords } };
//   }

//   private insertVertex(draw: DrawController, index: number, coord: Position) {
//     const feature = draw.features.find((f) => f.id === this._activeFeatureId);
//     if (!feature) return;

//     const coords = this.getCoords(feature);
//     coords.splice(index + 1, 0, coord);

//     if (feature.geometry.type === "Polygon") {
//       if (index + 1 === 0) coords[coords.length - 1] = [...coords[0]];
//       if (coords.length > 2) coords[coords.length - 1] = [...coords[0]];
//     }

//     draw.updateFeature(this._activeFeatureId, {
//       geometry: this.setCoords(feature, coords),
//       properties: { ...feature.properties, _vertices: coords },
//     });
//   }

//   // --- Handle Management ---
//   private createHandles(draw: DrawController) {
//     this.clearHandles(draw);
//     if (!this._activeFeatureId) return;

//     const feature = draw.features.find((f) => f.id === this._activeFeatureId);
//     if (!feature) return;

//     const coords = this.getCoords(feature, true);
//     const vertexHandles = coords.map((c, i) => draw.createHandle(c, i));
//     const midpointHandles = this.makeMidpoints(coords, feature.geometry.type === "Polygon");

//     this._handleIds = [...vertexHandles, ...midpointHandles].map((h) => h.id!);
//     draw.addFeatures([...vertexHandles, ...midpointHandles]);
//   }

//   private clearHandles(draw: DrawController) {
//     if (!this._handleIds.length) return;
//     draw.removeFeatures(this._handleIds);
//     this._handleIds = [];
//   }

//   private makeMidpoints(coords: Position[], isPolygon: boolean): Feature<Point>[] {
//     const midpoints: Feature<Point>[] = [];
//     for (let i = 0; i < coords.length - 1; i++) midpoints.push(this.makeMidpoint(coords[i], coords[i + 1], i));
//     if (isPolygon && coords.length > 2)
//       midpoints.push(this.makeMidpoint(coords[coords.length - 1], coords[0], coords.length - 1));
//     return midpoints;
//   }

//   private makeMidpoint(a: Position, b: Position, i: number): Feature<Point> {
//     const ma = toMercator(point(a)).geometry.coordinates;
//     const mb = toMercator(point(b)).geometry.coordinates;
//     const mid = toWgs84(point([(ma[0] + mb[0]) / 2, (ma[1] + mb[1]) / 2])).geometry.coordinates;
//     return {
//       id: uuid(),
//       type: "Feature",
//       geometry: { type: "Point", coordinates: mid },
//       properties: { handle: true, midpoint: true, insertIndex: i },
//     };
//   }

//   // --- Selection ---
//   private deselectAll(draw: DrawController) {
//     this._activeFeatureId = undefined;
//     this.clearHandles(draw);
//     const activeFeature = draw.features.find((f) => f.properties?.active);
//     if (activeFeature)
//       draw.updateFeature(activeFeature.id, { properties: { ...activeFeature.properties, active: false } });
//   }

//   private setActive(draw: DrawController, id: string | number | undefined) {
//     this._activeFeatureId = id;
//     draw.features.forEach((f) => {
//       draw.updateFeature(f.id, { properties: { ...f.properties, active: f.id === id } });
//     });
//     this.createHandles(draw);
//   }

//   // --- Coordinate Helpers ---
//   private getCoords(f: Feature, excludeLastPolygon = false): Position[] {
//     const coords = coordAll(f);
//     return excludeLastPolygon && f.geometry.type === "Polygon" ? coords.slice(0, -1) : coords;
//   }

//   private setCoords(f: Feature, coords: Position[]): Geometry {
//     switch (f.geometry.type) {
//       case "Point":
//         return { type: "Point", coordinates: coords[0] };
//       case "LineString":
//         return { type: "LineString", coordinates: coords };
//       case "Polygon":
//         return { type: "Polygon", coordinates: [coords] };
//       default:
//         throw new Error(`Unsupported geometry type: ${f.geometry.type}`);
//     }
//   }
// }
