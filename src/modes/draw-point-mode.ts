import { DrawMode, DrawController, DrawInfo } from "../core";

export class DrawPointMode implements DrawMode {
  onEnter(draw: DrawController) {
    draw.setCursor("crosshair");
  }

  onClick(info: DrawInfo, draw: DrawController) {
    const pointFeature = draw.store.generateFeature("point", [[info.lng, info.lat]]);
    if (pointFeature) draw.store.addFeature(pointFeature);
  }
}
