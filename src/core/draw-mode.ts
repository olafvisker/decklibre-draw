import type { DrawController } from "./draw-controller";
import type { ShapeFeatureProperties } from "./draw-state";
import type { Feature, Position } from "geojson";

export interface DrawInfo {
  x: number;
  y: number;
  lng: number;
  lat: number;
  feature: Feature | undefined;
}

export interface EditContext {
  controlPointIndex: number;
  controlPoints: Position[];
  delta: [number, number];
}

export interface DrawMode {
  name: string;

  onEnter?: (draw: DrawController) => void;
  onExit?: (draw: DrawController) => void;

  onClick?: (info: DrawInfo, draw: DrawController) => void;
  onDoubleClick?: (info: DrawInfo, draw: DrawController) => void;
  onMouseMove?: (info: DrawInfo, draw: DrawController) => void;
  onMouseDown?: (info: DrawInfo, draw: DrawController) => void;
  onMouseUp?: (info: DrawInfo, draw: DrawController) => void;

  generate?(
    draw: DrawController,
    points: Position[],
    ids?: (string | number)[],
    props?: Partial<ShapeFeatureProperties>,
  ): Feature[];

  createFeature?(draw: DrawController, points: Position[], props?: Partial<ShapeFeatureProperties>): Feature[];

  edit?(context: EditContext): Position[];
}
