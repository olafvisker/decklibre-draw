import type { Feature, LineString, Point, Position } from "geojson";
import { v4 as uuid } from "uuid";
import type { DrawMode } from "../draw-mode";
import type { DrawController, DrawInfo } from "../draw-controller";

export class DrawLineStringMode implements DrawMode {
  private coordinates: Position[] = [];
  private lineId?: string;
  private handleIds: (string | number)[] = [];

  onEnter(draw: DrawController) {
    draw.setDoubleClickZoom(false);
    draw.setCursor("crosshair");
  }

  onExit(draw: DrawController) {
    if (this.lineId) draw.removeFeature(this.lineId);
    this.reset(draw);
  }

  onClick(info: DrawInfo, draw: DrawController) {
    const { feature } = info;
    if (feature?.properties?.handle) {
      this.finishLine(draw);
      return;
    }

    this.coordinates.push([info.lng, info.lat]);
    this.upsertLine(draw);
    this.updateHandles(draw);
  }

  onDoubleClick(_info: DrawInfo, draw: DrawController) {
    this.finishLine(draw);
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (!this.lineId || this.coordinates.length === 0) return;
    const previewCoords = [...this.coordinates, [info.lng, info.lat]];
    this.updateLine(draw, previewCoords);
  }

  private upsertLine(draw: DrawController) {
    if (!this.lineId) {
      this.lineId = uuid();
      const lineFeature = this.createLineFeature(this.coordinates, this.lineId, true);
      draw.addFeature(lineFeature);
    } else {
      this.updateLine(draw, this.coordinates);
    }
  }

  private finishLine(draw: DrawController) {
    if (!this.lineId || this.coordinates.length < 2) return;

    this.updateLine(draw, this.coordinates, { active: false });
    this.reset(draw);
  }

  private updateLine(draw: DrawController, coords: Position[], updatedProperties?: Partial<Record<string, unknown>>) {
    draw.updateFeature(this.lineId, {
      geometry: { type: "LineString", coordinates: coords },
      properties: { ...(updatedProperties ?? {}), _vertices: coords },
    });
  }

  private updateHandles(draw: DrawController) {
    this.clearHandles(draw);

    const points: Feature<Point>[] = [];
    if (this.coordinates.length > 0) {
      points.push(draw.createHandle(this.coordinates[this.coordinates.length - 1]));
    }

    draw.addFeatures(points);
    this.handleIds = points.map((p) => p.id!);
  }

  private clearHandles(draw: DrawController) {
    draw.removeFeatures(this.handleIds);
    this.handleIds = [];
  }

  private createLineFeature(coords: Position[], id: string, active = false): Feature<LineString> {
    return {
      id,
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: { active, _vertices: coords },
    };
  }

  private reset(draw: DrawController) {
    this.clearHandles(draw);
    this.coordinates = [];
    this.lineId = undefined;
  }
}
