import type { Feature, Polygon, Position } from "geojson";
import { circle, distance, point } from "@turf/turf";

export interface CircleGeneratorOptions {
  steps?: number;
}

export const generateCircle = (points: Position[], options: CircleGeneratorOptions = {}): Feature<Polygon> => {
  const { steps = 64 } = options;
  const center = points[0];
  const edge = points[1];
  const radius = distance(point(center), point(edge), { units: "meters" });
  return circle(center, radius, { steps, units: "meters" });
};
