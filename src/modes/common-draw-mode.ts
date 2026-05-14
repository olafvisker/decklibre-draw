import { DrawController } from "../core";
import type { Feature, LineString, Point, Polygon, Position } from "geojson";
import { v4 as uuid } from "uuid";
import { generateCircle, generateCommon, generateRect } from "../generators";
import { BaseDrawMode, type BaseDrawModeOptions } from "./base-draw-mode";

export class DrawPointMode extends BaseDrawMode {
  name = "point";

  constructor(options?: Partial<BaseDrawModeOptions>) {
    super({ pointCount: 1, ...options });
  }

  generate(
    _draw: DrawController,
    points: Position[],
    id?: string | number,
    props?: Record<string, unknown>,
  ): Feature<Point> {
    const feature = generateCommon<Point>("Point", points);
    feature.id = id ?? uuid();
    feature.properties = {
      ...props,
      mode: this.name,
      handles: points,
    };
    return feature;
  }
}

export class DrawLineStringMode extends BaseDrawMode {
  name = "line";

  constructor(options?: Partial<BaseDrawModeOptions>) {
    super({ handleDisplay: "last", ...options });
  }

  generate(
    _draw: DrawController,
    points: Position[],
    id?: string | number,
    props?: Record<string, unknown>,
  ): Feature<LineString> {
    const feature = generateCommon<LineString>("LineString", points);
    feature.id = id ?? uuid();
    feature.properties = {
      ...props,
      mode: this.name,
      handles: points,
    };
    return feature;
  }
}

export class DrawPolygonMode extends BaseDrawMode {
  name = "polygon";

  constructor(options?: Partial<BaseDrawModeOptions>) {
    super({ handleDisplay: "first-last", ...options });
  }

  generate(
    _draw: DrawController,
    points: Position[],
    id?: string | number,
    props?: Record<string, unknown>,
  ): Feature<Polygon> {
    const feature = generateCommon<Polygon>("Polygon", points);
    feature.id = id ?? uuid();
    feature.properties = {
      ...props,
      mode: this.name,
      handles: points,
    };
    return feature;
  }
}

export class DrawCircleMode extends BaseDrawMode {
  name = "circle";

  constructor(options?: Partial<BaseDrawModeOptions>) {
    super({ pointCount: 2, handleDisplay: "first", ...options });
  }

  generate(
    _draw: DrawController,
    points: Position[],
    id?: string | number,
    props?: Record<string, unknown>,
  ): Feature<Polygon> {
    const feature = generateCircle(points);
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

export class DrawRectangleMode extends BaseDrawMode {
  name = "rectangle";

  constructor(options?: Partial<BaseDrawModeOptions>) {
    super({ pointCount: 2, handleDisplay: "first", ...options });
  }

  generate(
    _draw: DrawController,
    points: Position[],
    id?: string | number,
    props?: Record<string, unknown>,
  ): Feature<Polygon> {
    const feature = generateRect(points);
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
