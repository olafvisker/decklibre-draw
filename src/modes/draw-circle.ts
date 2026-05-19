import { DrawController } from "../core";
import type { Feature, Polygon, Position } from "geojson";
import { v4 as uuid } from "uuid";
import { circle, distance, point } from "@turf/turf";
import { BaseDrawMode, type BaseDrawModeOptions } from "./base-draw";

export interface CircleOptions extends BaseDrawModeOptions {
  steps?: number;
}

export class DrawCircleMode extends BaseDrawMode {
  name = "circle";
  private steps: number;

  constructor(options?: Partial<CircleOptions>) {
    const { steps = 64, ...baseOptions } = options || {};
    super({ pointCount: 2, handleDisplay: "first", ...baseOptions });
    this.steps = steps;
  }

  generate(
    _draw: DrawController,
    points: Position[],
    id?: string | number,
    props?: Record<string, unknown>,
  ): Feature<Polygon> {
    const center = points[0];
    const edge = points[1];
    const radius = distance(point(center), point(edge), { units: "meters" });
    const feature = circle(center, radius, { steps: this.steps, units: "meters" });

    feature.id = id ?? uuid();
    feature.properties = {
      ...props,
      mode: this.name,
      handles: points,
      insertable: false,
    };
    return feature;
  }
}
