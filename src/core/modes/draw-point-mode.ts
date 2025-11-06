import type { DrawMode } from "../draw-mode";
import type { DrawController, DrawInfo } from "../draw-controller";
import type { Feature, Point } from "geojson";
import { v4 as uuid } from "uuid";

export class DrawPointMode implements DrawMode {
  onEnter(draw: DrawController) {
    draw.setCursor("crosshair");
  }

  onClick(info: DrawInfo, draw: DrawController) {
    const pointFeature = this.createPoint([info.lng, info.lat]);
    draw.addFeature(pointFeature);
  }

  private createPoint(coord: [number, number]): Feature<Point> {
    return {
      id: uuid(),
      type: "Feature",
      geometry: { type: "Point", coordinates: coord },
      properties: { active: false, _vertices: [coord] },
    };
  }
}
