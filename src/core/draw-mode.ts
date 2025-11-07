import type { DrawController } from "./draw-controller";
import type { Feature } from "geojson";

export interface DrawInfo {
  x: number;
  y: number;
  lng: number;
  lat: number;
  feature: Feature | undefined;
}

export type DrawModeConstructor<O> = new (options?: O) => DrawMode;

export interface DrawMode {
  onEnter?: (draw: DrawController) => void;
  onExit?: (draw: DrawController) => void;

  onClick?: (info: DrawInfo, draw: DrawController) => void;
  onDoubleClick?: (info: DrawInfo, draw: DrawController) => void;
  onMouseMove?: (info: DrawInfo, draw: DrawController) => void;
  onMouseDown?: (info: DrawInfo, draw: DrawController) => void;
  onMouseUp?: (info: DrawInfo, draw: DrawController) => void;
}
