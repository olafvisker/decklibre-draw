import type { Feature, Geometry, LineString, Point, Polygon, Position } from "geojson";
import { distance, point, circle } from "@turf/turf";
import { DrawController } from "../core";

export type ShapeGeneratorFn = (draw: DrawController, points: Position[], options?: Record<string, unknown>) => Feature;

const geoJsonShapeGenerator = <T extends Geometry>(featureType: string, points: Position[]): Feature<T> => {
  const coords = featureType === "Point" ? points[0] : featureType === "LineString" ? points : [[...points, points[0]]];

  return {
    type: "Feature",
    geometry: { type: featureType, coordinates: coords },
    properties: {},
  } as Feature<T>;
};
export const pointShapeGenerator: ShapeGeneratorFn = (_draw, points) => geoJsonShapeGenerator<Point>("Point", points);
export const lineStringShapeGenerator: ShapeGeneratorFn = (_draw, points) =>
  geoJsonShapeGenerator<LineString>("LineString", points);
export const polygonShapeGenerator: ShapeGeneratorFn = (_draw, points) =>
  geoJsonShapeGenerator<Polygon>("Polygon", points);

export const circleShapeGenerator: ShapeGeneratorFn = (draw, points, options) => {
  const center = points[0];
  const edge = points[1];
  const steps = 64;

  // Geodesic circle using Turf
  if (options?.geodesic) {
    const radius = distance(point(center), point(edge), { units: "meters" });
    return circle(center, radius, { steps, units: "meters" });
  }

  // Screen space circle
  const centerPx = draw.project(center);
  const edgePx = draw.project(edge);

  const dx = edgePx[0] - centerPx[0];
  const dy = edgePx[1] - centerPx[1];
  const radiusPx = Math.sqrt(dx * dx + dy * dy);

  const coords: Position[] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (2 * Math.PI * i) / steps;
    const pointPx: Position = [centerPx[0] + radiusPx * Math.cos(angle), centerPx[1] + radiusPx * Math.sin(angle)];
    coords.push(draw.unproject(pointPx));
  }
  coords.push(coords[0]);

  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [coords] },
    properties: {},
  } as Feature<Polygon>;
};

export const rectangleShapeGenerator: ShapeGeneratorFn = (_draw, points) => {
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

  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [coords] },
    properties: {},
  } as Feature<Polygon>;
};

export const DefaultShapeGenerators: Record<string, ShapeGeneratorFn> = {
  point: pointShapeGenerator,
  line: lineStringShapeGenerator,
  polygon: polygonShapeGenerator,
  circle: circleShapeGenerator,
  rect: rectangleShapeGenerator,
};
