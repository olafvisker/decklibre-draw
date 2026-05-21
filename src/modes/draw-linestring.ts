import { DrawController } from "../core";
import type { Feature, LineString, Position } from "geojson";
import { v4 as uuid } from "uuid";
import { BaseDrawMode, type BaseDrawModeOptions } from "./base-draw";

export class DrawLineStringMode extends BaseDrawMode {
  name = "line";

  constructor(options?: Partial<BaseDrawModeOptions>) {
    super({ controlPointDisplay: "last", ...options });
  }

  generate(
    _draw: DrawController,
    points: Position[],
    ids?: (string | number)[],
    props?: Record<string, unknown>,
  ): Feature<LineString>[] {
    const feature: Feature<LineString> = {
      type: "Feature",
      id: ids?.[0] ?? uuid(),
      geometry: { type: "LineString", coordinates: points },
      properties: {
        ...props,
        mode: this.name,
      },
    };

    return [feature];
  }
}
