import type { Feature, Geometry, Position } from "geojson";

export const generateCommon = <T extends Geometry>(
  featureType: "Point" | "LineString" | "Polygon",
  points: Position[]
): Feature<T> => {
  const coords = featureType === "Point" ? points[0] : featureType === "LineString" ? points : [[...points, points[0]]];

  return {
    type: "Feature",
    geometry: { type: featureType, coordinates: coords },
    properties: {},
  } as Feature<T>;
};
