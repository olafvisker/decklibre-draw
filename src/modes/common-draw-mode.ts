import { DrawController } from "../core";
import type { Feature, LineString, Point, Polygon, Position } from "geojson";
import { v4 as uuid } from "uuid";
import { generateCircle, generateCommon, generateRect } from "../generators";
import { BaseDrawMode } from "./base-draw-mode";


export class DrawPointMode extends BaseDrawMode {
  readonly name = "point";

  constructor() {
    super({ pointCount: 1 });
  }

  generate(
    _draw: DrawController,
    points: Position[],
    id?: string | number,
    props?: Record<string, unknown>
  ): Feature<Point> {
    const feature = generateCommon<Point>("Point", points);
    feature.id = id ?? uuid();
    feature.properties = {
      mode: this.name,
      handles: points,
      ...props,
    };
    return feature;
  }
}

export class DrawLineStringMode extends BaseDrawMode {
  readonly name = "line";

  constructor() {
    super({ handleDisplay: "last" });
  }

  generate(
    _draw: DrawController,
    points: Position[],
    id?: string | number,
    props?: Record<string, unknown>
  ): Feature<LineString> {
    const feature = generateCommon<LineString>("LineString", points);
    feature.id = id ?? uuid();
    feature.properties = {
      mode: this.name,
      handles: points,
      ...props,
    };
    return feature;
  }
}

export class DrawPolygonMode extends BaseDrawMode {
  readonly name = "polygon";

  constructor() {
    super({ handleDisplay: "first-last" });
  }

  generate(
    _draw: DrawController,
    points: Position[],
    id?: string | number,
    props?: Record<string, unknown>
  ): Feature<Polygon> {
    const feature = generateCommon<Polygon>("Polygon", points);
    feature.id = id ?? uuid();
    feature.properties = {
      mode: this.name,
      handles: points,
      ...props,
    };
    return feature;
  }
}

export class DrawCircleMode extends BaseDrawMode {
  readonly name = "circle";

  constructor() {
    super({ pointCount: 2, handleDisplay: "first" });
  }

  generate(
    _draw: DrawController,
    points: Position[],
    id?: string | number,
    props?: Record<string, unknown>
  ): Feature<Polygon> {
    const feature = generateCircle(points);
    feature.id = id ?? uuid();
    feature.properties = {
      mode: this.name,
      handles: points,
      insertable: false,
      ...props,
    };
    return feature;
  }
}

export class DrawRectangleMode extends BaseDrawMode {
  readonly name = "rectangle";

  constructor() {
    super({ pointCount: 2, handleDisplay: "first" });
  }

  generate(
    _draw: DrawController,
    points: Position[],
    id?: string | number,
    props?: Record<string, unknown>
  ): Feature<Polygon> {
    const feature = generateRect(points);
    feature.id = id ?? uuid();
    feature.properties = {
      mode: this.name,
      handles: points,
      insertable: false,
      ...props,
    };
    return feature;
  }
}
