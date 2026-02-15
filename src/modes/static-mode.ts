import type { DrawMode } from "../core";
import { DrawController } from "../core";

export class StaticMode implements DrawMode {
  readonly name = "static";
  onEnter(draw: DrawController) {
    draw.setCursor({ default: "grab", pan: "grabbing" });
  }
}
