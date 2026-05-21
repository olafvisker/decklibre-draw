import { DrawCircleMode } from "../../src/modes";
import type { DrawController } from "../../src/core";
import type { Feature, Polygon, Position } from "geojson";
import { v4 as uuid } from "uuid";
import { distance, point, destination } from "@turf/turf";

/**
 * Example of a grouped features mode:
 * Extends DrawCircleMode to add a bounding box around the circle.
 */
export class DrawCircleWithBoxMode extends DrawCircleMode {
  name = "circle-with-box";

  override generate(
    draw: DrawController,
    points: Position[],
    ids?: (string | number)[],
    props?: Record<string, unknown>,
  ): Feature<Polygon>[] {
    if (points.length < 2) {
      return [];
    }

    const groupId = (props?.groupId as string | number) ?? uuid();

    const [circle] = super.generate(draw, points, ids ? [ids[0]] : undefined, props);

    if (circle.properties) {
      circle.properties.groupId = groupId;
    }

    // Calculate bounding box corners
    const center = points[0];
    const radius = distance(point(center), point(points[1]), { units: "meters" });
    const boxRadius = radius * Math.SQRT2;

    const topLeft = destination(center, boxRadius, -135, { units: "meters" }).geometry.coordinates;
    const topRight = destination(center, boxRadius, -45, { units: "meters" }).geometry.coordinates;
    const bottomRight = destination(center, boxRadius, 45, { units: "meters" }).geometry.coordinates;
    const bottomLeft = destination(center, boxRadius, 135, { units: "meters" }).geometry.coordinates;

    // Create box
    const box: Feature<Polygon> = {
      type: "Feature",
      id: ids?.[1] ?? uuid(),
      geometry: {
        type: "Polygon",
        coordinates: [[topLeft, topRight, bottomRight, bottomLeft, topLeft]],
      },
      properties: {
        ...props,
        groupId,
        isBox: true,
      },
    };

    return [circle, box];
  }
}
