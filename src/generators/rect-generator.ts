import type { Feature, Polygon, Position } from "geojson";

export const generateRect = (points: Position[]): Feature<Polygon> => {
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
  };
};
