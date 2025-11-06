import type { DrawMode } from "../draw-mode";
import type { DrawController, DrawInfo } from "../draw-controller";
import type { Feature, Point, Position } from "geojson";
import { v4 as uuid } from "uuid";
// import { circle as turfCircle, distance as turfDistance } from "@turf/turf";

export class DrawCircleMode implements DrawMode {
  private center?: Position;
  private circleId?: string;
  private handleIds: (string | number)[] = [];

  onEnter(draw: DrawController) {
    draw.setDoubleClickZoom(false);
    draw.setCursor("crosshair");
  }

  onExit(draw: DrawController) {
    if (this.circleId) draw.removeFeature(this.circleId);
    this.reset(draw);
  }

  onClick(info: DrawInfo, draw: DrawController) {
    if (!this.center) {
      this.center = [info.lng, info.lat];
      this.circleId = uuid();
      // const circleFeature = this.createCircleFeature(this.center, this.center, this.circleId, true);
      const circleFeature = draw.generateFeature("circle", [this.center, this.center]);
      if (circleFeature) {
        circleFeature.id = this.circleId;
        circleFeature.properties = { active: true, transform: "circle", _vertices: [this.center, this.center] };
        draw.addFeature(circleFeature);
      }
      const handle = draw.createHandle(this.center);
      draw.addFeature(handle);
      this.handleIds = [handle.id!];
      return;
    }

    if (this.center && this.circleId) {
      const end: Position = [info.lng, info.lat];
      this.updateCircle(draw, this.center, end, { active: false });
      const handle = draw.createHandle([info.lng, info.lat]);
      draw.addFeature(handle);
      this.handleIds.push(handle.id!);

      this.reset(draw);
    }
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (!this.center || !this.circleId) return;
    this.updateCircle(draw, this.center, [info.lng, info.lat], { active: true });
    const handle = draw.createHandle([info.lng, info.lat]);
    this.updateHandles(draw, handle);
  }

  private updateCircle(
    draw: DrawController,
    center: Position,
    end: Position,
    updatedProperties?: Partial<Record<string, unknown>>
  ) {
    if (!this.circleId) return;

    // const circleFeature = this.createCircleFeature(
    //   center,
    //   end,
    //   this.circleId,
    //   typeof updatedProperties?.active === "boolean" ? updatedProperties.active : true
    // );

    const circleFeature = draw.generateFeature("circle", [center, end]);

    draw.updateFeature(this.circleId, {
      id: this.circleId,
      ...circleFeature,
      properties: { ...updatedProperties, transform: "circle", _vertices: [center, end] },
    });
  }

  // private createCircleFeature(center: Position, end: Position, id: string, active = false): Feature<Polygon> {
  //   const radius = turfDistance(center, end, { units: "meters" });
  //   const circlePolygon = turfCircle(center, radius, { steps: 64, units: "meters" });
  //   const coords = circlePolygon.geometry.coordinates;
  //   return {
  //     id,
  //     type: "Feature",
  //     geometry: { type: "Polygon", coordinates: coords },
  //     properties: { active, _vertices: [center, end] },
  //   };
  // }

  private updateHandles(draw: DrawController, tempHandle: Feature<Point>) {
    this.clearHandles(draw);

    const points: Feature<Point>[] = [];
    if (this.center) points.push(draw.createHandle(this.center));
    points.push(tempHandle);

    draw.addFeatures(points);
    this.handleIds = points.map((p) => p.id!);
  }

  private clearHandles(draw: DrawController) {
    draw.removeFeatures(this.handleIds);
    this.handleIds = [];
  }

  private reset(draw: DrawController) {
    this.clearHandles(draw);
    this.center = undefined;
    this.circleId = undefined;
  }
}
