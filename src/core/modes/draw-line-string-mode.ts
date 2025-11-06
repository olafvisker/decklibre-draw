import type { DrawInfo, DrawMode } from "../draw-mode";
import type { DrawController } from "../draw-controller";
import type { Position } from "geojson";

export class DrawLineStringMode implements DrawMode {
  private coordinates: Position[] = [];
  private lineId?: string | number;

  onEnter(draw: DrawController) {
    draw.setCursor("crosshair");
    draw.setDoubleClickZoom(false);
  }

  onExit(draw: DrawController) {
    if (this.lineId) draw.store.removeFeature(this.lineId);
    this.reset(draw);
  }

  onClick(info: DrawInfo, draw: DrawController) {
    const coord: Position = [info.lng, info.lat];

    if (info.feature?.properties?.handle) {
      this.finishLine(draw);
      return;
    }

    this.coordinates.push(coord);

    if (!this.lineId) {
      const lineFeature = draw.store.generateFeature("line", this.coordinates, {
        props: { active: true },
      });
      if (!lineFeature) return;

      this.lineId = lineFeature.id;
      draw.store.addFeature(lineFeature);

      if (this.lineId) draw.store.createHandle(this.lineId, coord);
    } else {
      this.updateLine(draw, this.coordinates, { active: true });
      this.updateHandles(draw);
    }
  }

  onDoubleClick(_info: DrawInfo, draw: DrawController) {
    this.finishLine(draw);
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (!this.lineId || this.coordinates.length === 0) return;
    const previewCoords = [...this.coordinates, [info.lng, info.lat]];
    this.updateLine(draw, previewCoords, { active: true });
  }

  private updateLine(draw: DrawController, coords: Position[], props?: Record<string, unknown>) {
    if (!this.lineId) return;

    const lineFeature = draw.store.generateFeature("line", coords, {
      id: this.lineId,
      props,
    });
    if (!lineFeature) return;

    draw.store.updateFeature(this.lineId, lineFeature);
  }

  private updateHandles(draw: DrawController) {
    if (!this.lineId || this.coordinates.length === 0) return;
    draw.store.clearHandles(this.lineId);

    const lastCoord = this.coordinates[this.coordinates.length - 1];
    draw.store.createHandle(this.lineId, lastCoord);
  }

  private finishLine(draw: DrawController) {
    if (!this.lineId || this.coordinates.length < 2) return;
    this.updateLine(draw, this.coordinates, { active: false });
    draw.store.clearHandles(this.lineId);
    this.reset(draw);
  }

  private reset(draw: DrawController) {
    if (this.lineId) draw.store.clearHandles(this.lineId);
    this.coordinates = [];
    this.lineId = undefined;
  }
}
