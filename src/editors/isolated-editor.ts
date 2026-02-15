import type { Position } from "geojson";
import type { EditContext } from "../core";

export const isolatedEditor = ({ handles, handleIndex, delta }: EditContext): Position[] => {
  const [dx, dy] = delta;
  const updated = handles.map((coord, i) => (i === handleIndex ? [coord[0] + dx, coord[1] + dy] : coord));
  return updated;
};
