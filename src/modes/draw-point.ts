import { DrawController } from "../core";
import type { Feature, Point, Position } from "geojson";
import { v4 as uuid } from "uuid";
import { BaseDrawMode, type BaseDrawModeOptions } from "./base-draw";

export class DrawPointMode extends BaseDrawMode {
  name = "point";

  constructor(options?: Partial<BaseDrawModeOptions>) {
    super({ pointCount: 1, ...options });
  }

  generate(
    _draw: DrawController,
    points: Position[],
    ids?: (string | number)[],
    props?: Record<string, unknown>,
  ): Feature<Point>[] {
    const feature: Feature<Point> = {
      type: "Feature",
      geometry: { type: "Point", coordinates: points[0] },
      properties: {},
    };

    feature.id = ids?.[0] ?? uuid();
    feature.properties = {
      ...props,
      mode: this.name,
    };
    return [feature];
  }
}
