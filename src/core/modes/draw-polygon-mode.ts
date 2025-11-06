import type { DrawMode } from "../draw-mode";
import type { DrawController, DrawInfo } from "../draw-controller";
import type { Feature, Polygon, Point, Position } from "geojson";
import { v4 as uuid } from "uuid";

export class DrawPolygonMode implements DrawMode {
  private coordinates: Position[] = [];
  private polygonId?: string;
  private handleIds: (string | number)[] = [];

  onEnter(draw: DrawController) {
    draw.setDoubleClickZoom(false);
    draw.setCursor("crosshair");
  }

  onExit(draw: DrawController) {
    if (this.polygonId) draw.removeFeature(this.polygonId);
    this.reset(draw);
  }

  onClick(info: DrawInfo, draw: DrawController) {
    const { feature } = info;
    if (feature?.properties?.handle) {
      this.finishPolygon(draw);
      return;
    }
    this.coordinates.push([info.lng, info.lat]);
    this.upsertPolygon(draw);
    this.updateHandles(draw);
  }

  onDoubleClick(_info: DrawInfo, draw: DrawController) {
    this.finishPolygon(draw);
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (!this.polygonId || this.coordinates.length === 0) return;
    const previewCoords = [...this.coordinates, [info.lng, info.lat], this.coordinates[0]];
    this.updatePolygon(draw, previewCoords);
  }

  private upsertPolygon(draw: DrawController) {
    if (!this.polygonId) {
      this.polygonId = uuid();
      const polygonFeature = this.createPolygonFeature(this.polygonId, this.coordinates);
      draw.addFeature(polygonFeature);
    } else {
      this.updatePolygon(draw, [...this.coordinates, this.coordinates[0]]);
    }
  }

  private finishPolygon(draw: DrawController) {
    if (!this.polygonId || this.coordinates.length < 3) return;

    const closed = [...this.coordinates, this.coordinates[0]];
    this.updatePolygon(draw, closed, { active: false });
    this.reset(draw);
  }

  private updatePolygon(
    draw: DrawController,
    coords: Position[],
    updatedProperties?: Partial<Record<string, unknown>>
  ) {
    draw.updateFeature(this.polygonId, {
      geometry: { type: "Polygon", coordinates: [coords] },
      properties: { ...(updatedProperties ?? {}), _vertices: coords },
    });
  }

  private updateHandles(draw: DrawController) {
    this.clearHandles(draw);

    const points: Feature<Point>[] = [];

    if (this.coordinates.length > 0) {
      points.push(draw.createHandle(this.coordinates[0]));
    }
    if (this.coordinates.length > 1) {
      points.push(draw.createHandle(this.coordinates[this.coordinates.length - 1]));
    }

    draw.addFeatures(points);
    this.handleIds = points.map((p) => p.id!);
  }

  private clearHandles(draw: DrawController) {
    draw.removeFeatures(this.handleIds);
    this.handleIds = [];
  }

  private createPolygonFeature(id: string, coords: Position[]): Feature<Polygon> {
    return {
      id,
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [coords] },
      properties: { active: true, _vertices: coords },
    };
  }

  private reset(draw: DrawController) {
    this.clearHandles(draw);
    this.coordinates = [];
    this.polygonId = undefined;
  }
}
