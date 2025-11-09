import type { Feature, Point, Position, GeoJsonProperties } from "geojson";
import { v4 as uuid } from "uuid";
import { DefaultShapeGenerators, type ShapeGeneratorFn } from "../generators/generators";
import mitt from "mitt";
import { DrawStoreEvents } from "./draw-events";
import { DrawController } from "./draw-controller";

export interface GenerateFeatureOptions<P extends GeoJsonProperties = GeoJsonProperties> {
  id?: string | number;
  props?: P;
  shapeGeneratorOptions?: Record<string, unknown>;
}

export interface DrawStoreOptions {
  features?: Feature[];
  shapeGenerators?: Record<string, ShapeGeneratorFn>;
}

export class DrawStore {
  private _featureMap: Map<string | number, Feature> = new Map();
  private _selectedIds = new Set<string | number>();
  private _handles: Map<string | number, Feature<Point>[]> = new Map();
  private _shapeGenerator: Record<string, ShapeGeneratorFn> = {};
  private _emitter = mitt<DrawStoreEvents>();
  private _draw: DrawController;

  constructor(draw: DrawController, options?: DrawStoreOptions) {
    this._draw = draw;
    this._shapeGenerator = { ...DefaultShapeGenerators, ...options?.shapeGenerators };
    if (options?.features) this.addFeatures(options.features);
  }

  public on = this._emitter.on;
  public off = this._emitter.off;
  private _emit = this._emitter.emit;

  // --- Feature Management ---
  public get features(): Feature[] {
    return Array.from(this._featureMap.values());
  }

  public getFeature(id: string | number | undefined) {
    return id ? this._featureMap.get(id) : undefined;
  }

  public addFeature(feature: Feature) {
    this.addFeatures([feature]);
  }

  public addFeatures(features: Feature[]) {
    const added: Feature[] = [];
    if (!features.length) return;
    for (const f of features) {
      if (f.id === undefined) continue;
      this._featureMap.set(f.id, f);
      added.push(f);
    }
    this._emit("feature:add", { features: added });
    this._emit("feature:change", { features: this.features });
  }

  public removeFeature(id: string | number | undefined) {
    return this.removeFeatures([id]);
  }

  public removeFeatures(ids: (string | number | undefined)[]) {
    const validIds = ids.filter((id): id is string | number => id !== undefined);
    if (!validIds.length) return;
    for (const id of validIds) {
      this._featureMap.delete(id);
      this._selectedIds.delete(id);
      this.clearHandles(id);
    }
    this._emit("feature:remove", { ids: validIds });
    this._emit("feature:change", { features: this.features });
  }

  public removeAllFeature() {
    const ids = Array.from(this._featureMap.keys());
    for (const featureId of this._handles.keys()) {
      this.clearHandles(featureId);
    }
    this._featureMap.clear();
    this._selectedIds.clear();
    this._emit("feature:remove", { ids });
    this._emit("feature:change", { features: this.features });
  }

  public updateFeature(id: string | number | undefined, updates: Partial<Feature>) {
    if (!id) return;
    const feature = this._featureMap.get(id);
    if (!feature) return;

    if (updates.properties) feature.properties = { ...feature.properties, ...updates.properties };
    Object.assign(feature, updates);

    this._emit("feature:update", { features: [feature] });
    this._emit("feature:change", { features: this.features });
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
    const generator = this._shapeGenerator[name] ?? "default";
    if (!generator) {
      console.warn(`Generator "${name}" not found.`);
      return;
    }

    const feature = generator(this._draw, points, options?.shapeGeneratorOptions);
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
    for (const id of this._selectedIds) {
      const feature = this._featureMap.get(id);
      if (feature && feature.properties?.selected !== true) {
        feature.properties = { ...feature.properties, selected: true };
        changed = true;
      }
    }

    // Update unselected features
    for (const feature of this._featureMap.values()) {
      if (feature.properties?.selected && !this._selectedIds.has(feature.id!)) {
        feature.properties = { ...feature.properties, selected: false };
        changed = true;
      }
    }

    if (changed) {
      this._emit("selection:change", { selectedIds: this.selectedIds });
      this._emit("feature:update", { features: this.features });
      this._emit("feature:change", { features: this.features });
    }
  }
}
