import type { Feature, Point, Position, GeoJsonProperties } from "geojson";
import { v4 as uuid } from "uuid";
import { DefaultShapeGenerators, type ShapeGeneratorFn } from "./shape-generators";

export interface GenerateFeatureOptions<P extends GeoJsonProperties = GeoJsonProperties> {
  id?: string | number;
  props?: P;
}

export interface DrawStoreOptions {
  features?: Feature[];
  shapeGenerators?: Record<string, ShapeGeneratorFn>;
  onUpdate?: (features: Feature[]) => void;
}

export class DrawStore {
  private _features: Feature[] = [];
  private _handles: Map<string | number, Feature<Point>[]> = new Map();
  private _shapeGenerator: Record<string, ShapeGeneratorFn> = {};

  private _onUpdate?: (features: Feature[]) => void;

  constructor(options?: DrawStoreOptions) {
    this._features = options?.features ?? [];
    this._shapeGenerator = { ...DefaultShapeGenerators, ...options?.shapeGenerators };
    this._onUpdate = options?.onUpdate;
  }

  // --- Feature Management ---
  public get features() {
    return this._features;
  }

  public addFeature(feature: Feature) {
    this._features = [...this._features, feature];
    this._emitUpdate();
  }

  public addFeatures(features: Feature[]) {
    this._features = [...this._features, ...features];
    this._emitUpdate();
  }

  public removeFeature(id: string | number | undefined) {
    if (!id) return;
    this._features = this._features.filter((f) => f.id !== id);
    this.clearHandles(id);
    this._emitUpdate();
  }

  public removeFeatures(ids: (string | number | undefined)[]) {
    if (!ids.length) return;
    this._features = this._features.filter((f) => !ids.includes(f.id));
    ids.forEach((id) => this.clearHandles(id));
    this._emitUpdate();
  }

  public updateFeature(id: string | number | undefined, updates: Partial<Feature>) {
    this._features = this._features.map((f) =>
      f.id === id ? { ...f, ...updates, properties: { ...f.properties, ...updates.properties } } : f
    );
    this._emitUpdate();
  }

  // --- Handle Management ---
  public createHandle(featureId: string | number, coord: Position, index?: number): Feature<Point> {
    const handle: Feature<Point> = {
      id: uuid(),
      type: "Feature",
      geometry: { type: "Point", coordinates: coord },
      properties: { handle: true, _handleIndex: index ?? undefined },
    };

    const existing = this._handles.get(featureId) ?? [];
    this._handles.set(featureId, [...existing, handle]);
    this.addFeature(handle);
    return handle;
  }

  public clearHandles(featureId: string | number | undefined) {
    if (!featureId) return;
    const handles = this._handles.get(featureId);
    if (handles) {
      this.removeFeatures(handles.map((h) => h.id));
      this._handles.delete(featureId);
    }
  }

  public getHandles(featureId: string | number | undefined) {
    if (!featureId) return [];
    return this._handles.get(featureId) ?? [];
  }

  // --- Feature Generation ---
  public generateFeature(name: string, points: Position[], options?: GenerateFeatureOptions) {
    const generator = this._shapeGenerator[name];
    if (!generator) {
      console.warn(`Generator "${name}" not found.`);
      return;
    }

    const feature = generator(points);
    if (!feature) return;

    feature.id = options?.id || feature.id || uuid();
    feature.properties = { ...feature.properties, generator: name, handles: points, ...options?.props };

    return feature;
  }

  // --- Internal ---
  private _emitUpdate() {
    this._onUpdate?.(this._features);
  }
}
