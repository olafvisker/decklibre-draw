import { DrawMode, DrawController } from "../core";

export class StaticMode implements DrawMode {
  onEnter(draw: DrawController) {
    draw.setCursor({ default: "grab", pan: "grabbing" });
  }
}
