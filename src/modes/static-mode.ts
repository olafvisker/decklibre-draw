import { DrawMode, DrawController } from "../core";

export class StaticMode implements DrawMode {
  onEnter(draw: DrawController) {
    draw.setCursor({ default: "grab", pan: "grabbing" });
  }
}


// import { DrawMode, DrawController, DrawInfo } from "../core";

// export class StaticMode implements DrawMode {
//   onEnter(draw: DrawController) {
//     draw.setCursor({ default: "grab", pan: "grabbing" });
//   }
//   private points: [number, number][] = [];

//   onMouseDown(info: DrawInfo, draw: DrawController) {
//     this.points = [[info.lng, info.lat]];
//   }

//   onMouseMove(info: DrawInfo, draw: DrawController) {
//     if (this.points.length) {
//       this.points.push([info.lng, info.lat]);
//       const line = draw.store.generateFeature("line", this.points, { props: { selected: true } });
//       if (line) draw.store.updateFeature(line.id, line);
//     }
//   }

//   onMouseUp(_info: DrawInfo, draw: DrawController) {
//     this.points = [];
//   }
// }
