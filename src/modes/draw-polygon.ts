import { DrawController } from "../core";
import type { Feature, Polygon, Position } from "geojson";
import { v4 as uuid } from "uuid";
import { BaseDrawMode, type BaseDrawModeOptions } from "./base-draw";

export class DrawPolygonMode extends BaseDrawMode {
  name = "polygon";

  constructor(options?: Partial<BaseDrawModeOptions>) {
    super({ controlPointDisplay: "first-last", ...options });
  }

  generate(
    _draw: DrawController,
    points: Position[],
    id?: string | number,
    props?: Record<string, unknown>,
  ): Feature<Polygon> {
    const feature: Feature<Polygon> = {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[...points, points[0]]] },
      properties: {},
    };

    feature.id = id ?? uuid();
    feature.properties = {
      ...props,
      mode: this.name,
    };
    return feature;
  }
}
