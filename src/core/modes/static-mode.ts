import type { DrawController } from "../draw-controller";
import type { DrawMode } from "../draw-mode";

export class StaticMode implements DrawMode {
  onEnter(draw: DrawController) {
    draw.setCursor({ default: "grab", pan: "grabbing" });
  }
}
