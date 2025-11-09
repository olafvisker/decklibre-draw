import type { Feature } from "geojson";
import type { DrawMode } from "./draw-mode";

export type DrawStoreEvents = {
  "feature:add": { features: Feature[] };
  "feature:remove": { ids: (string | number)[] };
  "feature:update": { features: Feature[] };
  "feature:change": { features: Feature[] };
  "selection:change": { selectedIds: (string | number)[] };
};

export type DrawControllerEvents = DrawStoreEvents & {
  "mode:change": { name: string; mode: DrawMode; options?: Record<string, any> };
  "mode:options": { name: string; mode: DrawMode; options: Record<string, any> };
};
