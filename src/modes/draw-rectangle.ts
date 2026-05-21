import { DrawController } from "../core";
import type { Feature, Polygon, Position } from "geojson";
import { v4 as uuid } from "uuid";
import { BaseDrawMode, type BaseDrawModeOptions } from "./base-draw";

export class DrawRectangleMode extends BaseDrawMode {
  name = "rectangle";

  constructor(options?: Partial<BaseDrawModeOptions>) {
    super({ pointCount: 2, controlPointDisplay: "first", ...options });
  }

  generate(
    _draw: DrawController,
    points: Position[],
    ids?: (string | number)[],
    props?: Record<string, unknown>,
  ): Feature<Polygon>[] {
    const [start, end] = points;
    const [x1, y1] = start;
    const [x2, y2] = end;

    const coords: Position[] = [
      [x1, y1],
      [x2, y1],
      [x2, y2],
      [x1, y2],
      [x1, y1],
    ];

    const feature: Feature<Polygon> = {
      type: "Feature",
      id: ids?.[0] ?? uuid(),
      geometry: { type: "Polygon", coordinates: [coords] },
      properties: { insertable: false, ...props, mode: this.name },
    };

    return [feature];
  }
}
