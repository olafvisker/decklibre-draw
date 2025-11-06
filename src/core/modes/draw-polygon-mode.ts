import type { DrawInfo, DrawMode } from "../draw-mode";
import type { DrawController } from "../draw-controller";
import type { Position } from "geojson";

export class DrawPolygonMode implements DrawMode {
  private coordinates: Position[] = [];
  private polygonId?: string | number;

  onEnter(draw: DrawController) {
    draw.setDoubleClickZoom(false);
    draw.setCursor("crosshair");
  }

  onExit(draw: DrawController) {
    if (this.polygonId) draw.store.removeFeature(this.polygonId);
    this.reset(draw);
  }

  onClick(info: DrawInfo, draw: DrawController) {
    const { feature } = info;

    if (feature?.properties?.handle) {
      this.finishPolygon(draw);
      return;
    }

    const coord: Position = [info.lng, info.lat];
    this.coordinates.push(coord);

    if (!this.polygonId) {
      const polygonFeature = draw.store.generateFeature("polygon", this.coordinates, {
        props: { active: true },
      });
      if (!polygonFeature) return;

      this.polygonId = polygonFeature.id;
      draw.store.addFeature(polygonFeature);

      if (this.polygonId) draw.store.createHandle(this.polygonId, coord);
    } else {
      this.updatePolygon(draw, this.coordinates, { active: true });
      this.updateHandles(draw);
    }
  }

  onDoubleClick(_info: DrawInfo, draw: DrawController) {
    this.finishPolygon(draw);
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (!this.polygonId || this.coordinates.length === 0) return;
    const previewCoords = [...this.coordinates, [info.lng, info.lat]];
    this.updatePolygon(draw, previewCoords, { active: true });
  }

  private updatePolygon(draw: DrawController, coords: Position[], props?: Record<string, unknown>) {
    if (!this.polygonId) return;

    const polygonFeature = draw.store.generateFeature("polygon", coords, {
      id: this.polygonId,
      props,
    });
    if (!polygonFeature) return;

    draw.store.updateFeature(this.polygonId, polygonFeature);
  }

  private updateHandles(draw: DrawController) {
    if (!this.polygonId || this.coordinates.length === 0) return;

    draw.store.clearHandles(this.polygonId);
    draw.store.createHandle(this.polygonId, this.coordinates[0]);
    if (this.coordinates.length > 1) {
      draw.store.createHandle(this.polygonId, this.coordinates[this.coordinates.length - 1]);
    }
  }

  private finishPolygon(draw: DrawController) {
    if (!this.polygonId || this.coordinates.length < 3) return;

    this.updatePolygon(draw, this.coordinates, { active: false });
    draw.store.clearHandles(this.polygonId);
    this.reset(draw);
  }

  private reset(draw: DrawController) {
    if (this.polygonId) draw.store.clearHandles(this.polygonId);
    this.coordinates = [];
    this.polygonId = undefined;
  }
}
