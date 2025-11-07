import { Feature, Position } from 'geojson';
export type ShapeGeneratorFn = ((points: Position[]) => Feature) & {
    shapeName?: string;
};
export declare const PointShapeGenerator: ShapeGeneratorFn;
export declare const LineStringShapeGenerator: ShapeGeneratorFn;
export declare const PolygonShapeGenerator: ShapeGeneratorFn;
export declare const CircleShapeGenerator: ShapeGeneratorFn;
export declare const RectangleShapeGenerator: ShapeGeneratorFn;
export declare const DefaultShapeGenerators: Record<string, ShapeGeneratorFn>;
