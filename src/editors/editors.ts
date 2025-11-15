import type { Feature, Position } from "geojson";
import type { DrawController } from "../core";

export interface HandleEditContext {
  feature: Feature;
  handleIndex: number;
  handles: Position[];
  delta: [number, number]; // [dx, dy]
  draw: DrawController;
}

export interface HandleEditResult {
  handles: Position[];
  additionalUpdates?: Partial<Feature>;
}

export type EditorFn = (context: HandleEditContext) => HandleEditResult;

/**
 * Default: Move only the selected handle
 */
export const isolatedEditor: EditorFn = ({ handles, handleIndex, delta }) => {
  const [dx, dy] = delta;
  const updated = handles.map((coord, i) => (i === handleIndex ? [coord[0] + dx, coord[1] + dy] : coord));
  return { handles: updated };
};

/**
 * Symmetric: Move opposite handle in the opposite direction
 * Useful for rectangles, ellipses, etc.
 */
export const symmetricEditor: EditorFn = ({ handles, handleIndex, delta }) => {
  const [dx, dy] = delta;
  const oppositeIndex = (handleIndex + 2) % 4; // Works for 4-point shapes

  const updated = handles.map((coord, i) => {
    if (i === handleIndex) return [coord[0] + dx, coord[1] + dy];
    if (i === oppositeIndex) return [coord[0] - dx, coord[1] - dy];
    return coord;
  });

  return { handles: updated };
};

/**
 * Mirror: Move opposite handle in the same direction (maintain center)
 * Useful for centered shapes
 */
export const mirrorEditor: EditorFn = ({ handles, handleIndex, delta }) => {
  const [dx, dy] = delta;
  const oppositeIndex = (handleIndex + Math.floor(handles.length / 2)) % handles.length;

  const updated = handles.map((coord, i) => {
    if (i === handleIndex || i === oppositeIndex) {
      return [coord[0] + dx, coord[1] + dy];
    }
    return coord;
  });

  return { handles: updated };
};

/**
 * Constrained: Move handle but maintain relationships with adjacent handles
 * Useful for rectangles where you want to maintain right angles
 */
export const constrainedRectangleEditor: EditorFn = ({ handles, handleIndex, delta }) => {
  if (handles.length !== 4) return isolatedEditor({ handles, handleIndex, delta } as HandleEditContext);

  const [dx, dy] = delta;
  const updated = [...handles];

  // For a rectangle with handles [0, 1, 2, 3]:
  // Moving handle 0 affects handles 1 and 3
  const prevIndex = (handleIndex - 1 + 4) % 4;
  const nextIndex = (handleIndex + 1) % 4;

  updated[handleIndex] = [handles[handleIndex][0] + dx, handles[handleIndex][1] + dy];
  updated[prevIndex] = [handles[prevIndex][0] + dx, handles[prevIndex][1]];
  updated[nextIndex] = [handles[nextIndex][0], handles[nextIndex][1] + dy];

  return { handles: updated };
};

/**
 * Circle/Ellipse: Moving edge handle updates radius while maintaining center
 */
export const circleRadiusEditor: EditorFn = ({ handles, handleIndex, delta }) => {
  if (handles.length !== 2) return isolatedEditor({ handles, handleIndex, delta } as HandleEditContext);

  const [dx, dy] = delta;

  // Handle 0 is center, handle 1 is radius point
  if (handleIndex === 0) {
    // Moving center moves both
    return {
      handles: [
        [handles[0][0] + dx, handles[0][1] + dy],
        [handles[1][0] + dx, handles[1][1] + dy],
      ],
    };
  } else {
    // Moving radius point
    return {
      handles: [
        handles[0], // Center stays
        [handles[1][0] + dx, handles[1][1] + dy],
      ],
    };
  }
};

/**
 * Proportional: Scale all handles proportionally from center
 */
export const proportionalScaleEditor: EditorFn = ({ handles, handleIndex, delta }) => {
  const [dx, dy] = delta;

  // Calculate center
  const center = handles.reduce(
    (acc, coord) => [acc[0] + coord[0] / handles.length, acc[1] + coord[1] / handles.length],
    [0, 0] as Position
  );

  // Calculate scale factor based on handle movement
  const originalDist = Math.sqrt(
    Math.pow(handles[handleIndex][0] - center[0], 2) + Math.pow(handles[handleIndex][1] - center[1], 2)
  );

  const newHandlePos: Position = [handles[handleIndex][0] + dx, handles[handleIndex][1] + dy];
  const newDist = Math.sqrt(Math.pow(newHandlePos[0] - center[0], 2) + Math.pow(newHandlePos[1] - center[1], 2));

  const scale = originalDist > 0 ? newDist / originalDist : 1;

  const updated = handles.map((coord) => [
    center[0] + (coord[0] - center[0]) * scale,
    center[1] + (coord[1] - center[1]) * scale,
  ]);

  return { handles: updated };
};

export const DefaultEditModes: Record<string, EditorFn> = {
  isolated: isolatedEditor,
  symmetric: symmetricEditor,
  mirror: mirrorEditor,
  rectangle: constrainedRectangleEditor,
  circle: circleRadiusEditor,
  proportional: proportionalScaleEditor,
};
