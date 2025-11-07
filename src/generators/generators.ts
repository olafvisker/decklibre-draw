import type { Feature, LineString, Point, Polygon, Position } from "geojson";
import { distance, point, circle } from "@turf/turf";

export type ShapeGeneratorFn = ((points: Position[]) => Feature) & { shapeName?: string };

export const PointShapeGenerator: ShapeGeneratorFn = (points) => {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: points[0] },
    properties: {},
  } as Feature<Point>;
};

export const LineStringShapeGenerator: ShapeGeneratorFn = (points) => {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: points },
    properties: {},
  } as Feature<LineString>;
};

export const PolygonShapeGenerator: ShapeGeneratorFn = (points) => {
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [[...points, points[0]]] },
    properties: {},
  } as Feature<Polygon>;
};

export const CircleShapeGenerator: ShapeGeneratorFn = (points) => {
  const center = points[0];
  const edge = points[1];
  const radius = distance(point(center), point(edge), { units: "meters" });
  return circle(center, radius, { steps: 64, units: "meters" });
};

export const RectangleShapeGenerator: ShapeGeneratorFn = (points) => {
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
  point: PointShapeGenerator,
  line: LineStringShapeGenerator,
  polygon: PolygonShapeGenerator,
  circle: CircleShapeGenerator,
  rect: RectangleShapeGenerator,
};
