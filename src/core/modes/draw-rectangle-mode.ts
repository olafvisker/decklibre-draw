import type { DrawInfo, DrawMode } from "../draw-mode";
import type { DrawController } from "../draw-controller";
import type { Position } from "geojson";

export class DrawRectangleMode implements DrawMode {
  private start?: Position;
  private rectId?: string | number;

  onEnter(draw: DrawController) {
    draw.setDoubleClickZoom(false);
    draw.setCursor("crosshair");
  }

  onExit(draw: DrawController) {
    if (this.rectId) draw.store.removeFeature(this.rectId);
    this.reset(draw);
  }

  onClick(info: DrawInfo, draw: DrawController) {
    if (!this.start) {
      this.start = [info.lng, info.lat];
      const rectFeature = draw.store.generateFeature("rect", [this.start, this.start], {
        props: { active: true, insertable: false },
      });
      if (!rectFeature) return;

      this.rectId = rectFeature.id;
      draw.store.addFeature(rectFeature);

      if (this.rectId) draw.store.createHandle(this.rectId, this.start);
      return;
    }

    if (this.start && this.rectId) {
      const end: Position = [info.lng, info.lat];
      this.updateRect(draw, this.start, end, { active: false });
      this.reset(draw);
    }
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (!this.start || !this.rectId) return;
    const end: Position = [info.lng, info.lat];
    this.updateRect(draw, this.start, end, { active: true });
  }

  private updateRect(
    draw: DrawController,
    start: Position,
    end: Position,
    updatedProperties?: Partial<Record<string, unknown>>
  ) {
    if (!this.rectId) return;

    const rectFeature = draw.store.generateFeature("rect", [start, end], {
      id: this.rectId,
      props: updatedProperties,
    });
    if (!rectFeature) return;
    draw.store.updateFeature(this.rectId, rectFeature);
  }

  private reset(draw: DrawController) {
    draw.store.clearHandles(this.rectId);
    this.start = undefined;
    this.rectId = undefined;
  }
}
