import type { DrawController } from "./draw-controller";
import type { Feature } from "geojson";

export interface DrawInfo {
  x: number;
  y: number;
  lng: number;
  lat: number;
  feature: Feature | undefined;
}

export interface DrawMode {
  onEnter?: (controller: DrawController) => void;
  onExit?: (controller: DrawController) => void;

  onClick?: (info: DrawInfo, controller: DrawController) => void;
  onDoubleClick?: (info: DrawInfo, controller: DrawController) => void;
  onMouseMove?: (info: DrawInfo, controller: DrawController) => void;
  onMouseDown?: (info: DrawInfo, controller: DrawController) => void;
  onMouseUp?: (info: DrawInfo, controller: DrawController) => void;
}
