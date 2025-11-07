import { Feature, Point, Position, GeoJsonProperties } from 'geojson';
import { ShapeGeneratorFn } from './shape-generators';
export interface GenerateFeatureOptions<P extends GeoJsonProperties = GeoJsonProperties> {
    id?: string | number;
    props?: P;
}
export interface DrawStoreOptions {
    features?: Feature[];
    shapeGenerators?: Record<string, ShapeGeneratorFn>;
    onUpdate?: (features: Feature[], selectedIds: (string | number)[]) => void;
}
export declare class DrawStore {
    private _featureMap;
    private _selectedIds;
    private _handles;
    private _shapeGenerator;
    private _onUpdate?;
    constructor(options?: DrawStoreOptions);
    get features(): Feature[];
    getFeature(id: string | number | undefined): Feature<import('geojson').Geometry, GeoJsonProperties> | undefined;
    addFeature(feature: Feature): void;
    addFeatures(features: Feature[]): void;
    removeFeature(id: string | number | undefined): void;
    removeFeatures(ids: (string | number | undefined)[]): void;
    updateFeature(id: string | number | undefined, updates: Partial<Feature>): void;
    createHandle(featureId: string | number, coord: Position, index?: number): Feature<Point>;
    clearHandles(featureId: string | number | undefined): void;
    getHandles(featureId: string | number | undefined): Feature<Point, GeoJsonProperties>[];
    generateFeature(name: string, points: Position[], options?: GenerateFeatureOptions): Feature<import('geojson').Geometry, GeoJsonProperties> | undefined;
    get selectedIds(): (string | number)[];
    isSelected(id: string | number): boolean;
    setSelected(id: string | number | undefined): void;
    clearSelection(): void;
    private _syncSelectionState;
    private _emitUpdate;
}
