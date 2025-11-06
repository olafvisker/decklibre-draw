import type { DrawController, DrawInfo } from "./draw-controller";

export interface DrawMode {
  onEnter?: (controller: DrawController) => void;
  onExit?: (controller: DrawController) => void;

  onClick?: (info: DrawInfo, controller: DrawController) => void;
  onDoubleClick?: (info: DrawInfo, controller: DrawController) => void;
  onMouseMove?: (info: DrawInfo, controller: DrawController) => void;
  onMouseDown?: (info: DrawInfo, controller: DrawController) => void;
  onMouseUp?: (info: DrawInfo, controller: DrawController) => void;
}
