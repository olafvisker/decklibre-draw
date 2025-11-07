import type { DrawInfo, DrawMode } from "../draw-mode";
import type { DrawController } from "../draw-controller";
import type { Position } from "geojson";

export class DrawCircleMode implements DrawMode {
  private center?: Position;
  private circleId?: string | number;

  onEnter(draw: DrawController) {
    draw.setDoubleClickZoom(false);
    draw.setCursor("crosshair");
  }

  onExit(draw: DrawController) {
    if (this.circleId) draw.store.removeFeature(this.circleId);
    this.reset(draw);
  }

  onClick(info: DrawInfo, draw: DrawController) {
    if (!this.center) {
      this.center = [info.lng, info.lat];
      const circleFeature = draw.store.generateFeature("circle", [this.center, this.center], {
        props: this.withDefaultProps({ selected: true }),
      });
      if (!circleFeature) return;

      this.circleId = circleFeature.id;

      draw.store.addFeature(circleFeature);

      if (this.circleId) draw.store.createHandle(this.circleId, this.center);
      return;
    }

    if (this.center && this.circleId) {
      const end: Position = [info.lng, info.lat];
      this.updateCircle(draw, this.center, end, { selected: false });

      draw.store.clearHandles(this.circleId);
      draw.store.createHandle(this.circleId, this.center);
      draw.store.createHandle(this.circleId, end);

      this.reset(draw);
    }
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (!this.center || !this.circleId) return;
    const radiusEnd: Position = [info.lng, info.lat];
    this.updateCircle(draw, this.center, radiusEnd, { selected: true });
  }

  private updateCircle(
    draw: DrawController,
    center: Position,
    end: Position,
    updatedProperties?: Partial<Record<string, unknown>>
  ) {
    if (!this.circleId) return;

    const circleFeature = draw.store.generateFeature("circle", [center, end], {
      id: this.circleId,
      props: this.withDefaultProps(updatedProperties),
    });
    if (!circleFeature) return;
    draw.store.updateFeature(this.circleId, circleFeature);
  }

  private reset(draw: DrawController) {
    draw.store.clearHandles(this.circleId);
    this.center = undefined;
    this.circleId = undefined;
  }

  private withDefaultProps(props?: Record<string, unknown>) {
    return { insertable: false, ...props };
  }
}
