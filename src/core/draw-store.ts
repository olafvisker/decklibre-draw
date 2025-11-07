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
  onUpdate?: (features: Feature[], selectedIds: (string | number)[]) => void;
}

export class DrawStore {
  private _featureMap: Map<string | number, Feature> = new Map();
  private _selectedIds = new Set<string | number>();
  private _handles: Map<string | number, Feature<Point>[]> = new Map();
  private _shapeGenerator: Record<string, ShapeGeneratorFn> = {};
  private _onUpdate?: (features: Feature[], selectedIds: (string | number)[]) => void;

  constructor(options?: DrawStoreOptions) {
    this._shapeGenerator = { ...DefaultShapeGenerators, ...options?.shapeGenerators };
    this._onUpdate = options?.onUpdate;

    if (options?.features) {
      for (const f of options.features) {
        if (f.id !== undefined) this._featureMap.set(f.id, f);
      }
    }
  }

  // --- Feature Management ---
  public get features(): Feature[] {
    return Array.from(this._featureMap.values());
  }

  public getFeature(id: string | number | undefined) {
    if (!id) return;
    return this._featureMap.get(id);
  }

  public addFeature(feature: Feature) {
    this.addFeatures([feature]);
  }

  public addFeatures(features: Feature[]) {
    for (const f of features) {
      if (f.id !== undefined) this._featureMap.set(f.id, f);
    }
    this._emitUpdate();
  }

  public removeFeature(id: string | number | undefined) {
    return this.removeFeatures([id]);
  }

  public removeFeatures(ids: (string | number | undefined)[]) {
    if (!ids.length) return;
    ids.forEach((id) => {
      if (id !== undefined) this._featureMap.delete(id);
      this.clearHandles(id);
    });
    this._emitUpdate();
  }

  public updateFeature(id: string | number | undefined, updates: Partial<Feature>) {
    if (!id) return;
    const feature = this._featureMap.get(id);
    if (!feature) return;

    Object.assign(feature, updates);
    if (updates.properties) {
      feature.properties = { ...feature.properties, ...updates.properties };
    }
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

  // --- Selection Management ---
  public get selectedIds(): (string | number)[] {
    return Array.from(this._selectedIds);
  }

  public isSelected(id: string | number): boolean {
    return this._selectedIds.has(id);
  }

  public setSelected(id: string | number | undefined) {
    this._selectedIds.clear();
    if (id !== undefined) this._selectedIds.add(id);
    this._syncSelectionState();
  }

  public clearSelection() {
    this._selectedIds.clear();
    this._syncSelectionState();
  }

  private _syncSelectionState() {
    let changed = false;

    // Update selected features
    this._selectedIds.forEach((id) => {
      const feature = this._featureMap.get(id);
      if (feature && feature.properties?.selected !== true) {
        feature.properties = { ...feature.properties, selected: true };
        changed = true;
      }
    });

    // Update unselected features
    for (const feature of this._featureMap.values()) {
      if (feature.id && !this._selectedIds.has(feature.id) && feature.properties?.selected) {
        feature.properties = { ...feature.properties, selected: false };
        changed = true;
      }
    }

    if (changed) this._emitUpdate();
  }

  // --- Internal ---
  private _emitUpdate() {
    this._onUpdate?.(this.features, this.selectedIds);
  }
}
