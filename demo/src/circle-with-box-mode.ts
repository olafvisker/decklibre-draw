import { DrawCircleMode } from "../../src/modes";
import type { DrawController } from "../../src/core";
import type { Feature, Polygon, Position } from "geojson";
import { v4 as uuid } from "uuid";
import { distance, point, destination } from "@turf/turf";

/**
 * Example of a grouped features mode:
 * Extends DrawCircleMode to add a bounding box around the circle.
 */
export class CircleWithBoxMode extends DrawCircleMode {
  name = "circle-with-box";

  // @ts-expect-error - Overriding to return array instead of single feature
  generate(
    draw: DrawController,
    points: Position[],
    id?: string | number | (string | number)[],
    props?: Record<string, unknown>,
  ): Feature[] {
    if (points.length < 2) {
      // Return empty array for invalid input
      return [];
    }

    const groupId = (props?.groupId as string | number) ?? uuid();
    const ids = Array.isArray(id) ? id : [uuid(), uuid()];

    // Call parent to generate circle, passing only the first ID
    // Pass props WITHOUT handles to parent to avoid any interference
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { handles, ...propsWithoutHandles } = props || {};
    const circle = super.generate(draw, points, ids[0], propsWithoutHandles);

    // Override mode name, add grouping, and set handles explicitly
    if (circle.properties) {
      circle.properties.mode = this.name;
      circle.properties.handles = points; // Explicitly set handles to the control points
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

    // Create box with only necessary properties
    const box: Feature<Polygon> = {
      type: "Feature",
      id: ids[1],
      geometry: {
        type: "Polygon",
        coordinates: [[topLeft, topRight, bottomRight, bottomLeft, topLeft]],
      },
      properties: {
        mode: this.name,
        groupId,
        isBox: true,
        insertable: false,
        handles: undefined, // Explicitly clear handles (updateFeature merges properties)
      },
    };

    // Copy only selection/preview state from props if present
    if (box.properties) {
      if (props?.preview !== undefined) box.properties.preview = props.preview;
      if (props?.selected !== undefined) box.properties.selected = props.selected;
    }

    return [circle, box];
  }
}
