import type { Feature, GeoJsonProperties, Geometry, Point, Position } from "geojson";
import { v4 as uuid } from "uuid";
import mitt from "mitt";

export type ShapeFeatureProperties = GeoJsonProperties & {
  mode: string;
  handles: Position[];
  preview?: boolean;
  selected?: boolean;
};

export type HandleFeatureProperties = GeoJsonProperties & {
  handle?: boolean;
  midpoint?: boolean;
  featureId: string | number;
  index: number;
};

export type DrawFeatureProperties = Partial<ShapeFeatureProperties & HandleFeatureProperties> | null;

export type DrawFeature = Feature<Geometry, DrawFeatureProperties>;
export type ShapeFeature = Feature<Geometry, ShapeFeatureProperties>;
export type HandleFeature = Feature<Point, HandleFeatureProperties>;

export type DrawStateEvents = {
  "feature:add": { features: DrawFeature[] };
  "feature:remove": { ids: (string | number)[] };
  "feature:update": { features: DrawFeature[] };
  "feature:change": { features: DrawFeature[] };
  "selection:change": { selectedIds: (string | number)[] };
};

export interface DrawStateOptions {
  features?: Feature[];
}

export class DrawState {
  private _emitter = mitt<DrawStateEvents>();

  private _featureMap: Map<string | number, DrawFeature> = new Map();
  private _handleMap: Map<string | number, HandleFeature[]> = new Map();
  private _selectedFeatureIds = new Set<string | number>();

  // Cache the features array - only recreate when map changes
  private _featuresCache: DrawFeature[] = [];
  private _featuresCacheDirty = true;

  constructor(options?: DrawStateOptions) {
    if (options?.features) this.addFeatures(options.features);
  }

  public on = this._emitter.on;
  public off = this._emitter.off;
  private _emit = this._emitter.emit;

  // --- Feature Management ---
  public get features(): DrawFeature[] {
    if (this._featuresCacheDirty) {
      this._featuresCache = Array.from(this._featureMap.values());
      this._featuresCacheDirty = false;
    }
    return this._featuresCache;
  }

  private _invalidateCache() {
    this._featuresCacheDirty = true;
  }

  public getFeature(id: string | number): DrawFeature | undefined {
    return this._featureMap.get(id);
  }

  public addFeature(feature: Feature) {
    this.addFeatures([feature]);
  }

  public addFeatures(features: Feature[]) {
    const added: DrawFeature[] = [];
    if (!features.length) return;
    for (const f of features) {
      if (f.id === undefined) continue;
      // Cast to UnifiedFeature - the type is compatible
      const unifiedFeature = f as DrawFeature;
      this._featureMap.set(f.id!, unifiedFeature);
      added.push(unifiedFeature);
    }
    this._invalidateCache();
    this._emit("feature:add", { features: added });
    this._emit("feature:change", { features: this.features });
  }

  public removeFeature(id: string | number) {
    return this.removeFeatures([id]);
  }

  public removeFeatures(ids: (string | number)[]) {
    if (!ids.length) return;
    let selectionChanged = false;
    for (const id of ids) {
      this._featureMap.delete(id);
      if (this._selectedFeatureIds.delete(id)) {
        selectionChanged = true;
      }
      this.clearHandles(id);
    }
    this._invalidateCache();
    this._emit("feature:remove", { ids });
    this._emit("feature:change", { features: this.features });
    if (selectionChanged) this._emit("selection:change", { selectedIds: this.selectedIds });
  }

  public removeAllFeature() {
    const ids = Array.from(this._featureMap.keys());
    for (const featureId of this._handleMap.keys()) {
      this.clearHandles(featureId);
    }
    const hadSelection = this._selectedFeatureIds.size > 0;
    this._featureMap.clear();
    this._selectedFeatureIds.clear();
    this._invalidateCache();

    this._emit("feature:remove", { ids });
    this._emit("feature:change", { features: this.features });
    if (hadSelection) this._emit("selection:change", { selectedIds: [] });
  }

  public updateFeature(id: string | number, updates: Partial<Feature>) {
    const feature = this._featureMap.get(id);
    if (!feature) return;

    // Create new feature object instead of mutating
    const updated = { ...feature, ...updates };
    if (updates.properties && feature.properties) {
      updated.properties = { ...feature.properties, ...updates.properties };
    }

    this._featureMap.set(id, updated);
    this._invalidateCache();
    this._emit("feature:update", { features: [updated] });
    this._emit("feature:change", { features: this.features });
  }

  // --- Handle Management ---
  public createHandle(
    featureId: string | number,
    coord: Position,
    index: number,
    asMidpoint: boolean = false,
  ): HandleFeature {
    const handle: HandleFeature = {
      id: uuid(),
      type: "Feature",
      geometry: { type: "Point", coordinates: coord },
      properties: { handle: !asMidpoint, midpoint: asMidpoint, featureId, index },
    };

    const existing = this._handleMap.get(featureId) ?? [];
    this._handleMap.set(featureId, [...existing, handle]);
    this.addFeature(handle);
    return handle;
  }

  public clearHandles(featureId: string | number) {
    const handle = this._handleMap.get(featureId);
    if (handle) {
      this.removeFeatures(handle.map((h) => h.id!));
      this._handleMap.delete(featureId);
    }
  }

  public getHandles(featureId: string | number) {
    return this._handleMap.get(featureId) ?? [];
  }

  public updateHandle(handleId: string | number, coord: Position) {
    const handle = this._featureMap.get(handleId) as HandleFeature;
    if (!handle) return;

    const updated: HandleFeature = {
      ...handle,
      geometry: { type: "Point", coordinates: coord },
    };

    this._featureMap.set(handleId, updated);

    // Update in handle map
    const featureId = handle.properties.featureId;
    const handles = this._handleMap.get(featureId);
    if (handles) {
      const index = handles.findIndex((h) => h.id === handleId);
      if (index !== -1) {
        handles[index] = updated;
      }
    }

    this._invalidateCache();
    this._emit("feature:update", { features: [updated] });
    this._emit("feature:change", { features: this.features });
  }

  // --- Selection Management ---
  public get selectedIds(): (string | number)[] {
    return Array.from(this._selectedFeatureIds);
  }

  public isSelected(id: string | number): boolean {
    return this._selectedFeatureIds.has(id);
  }

  public setSelected(id: string | number) {
    this._selectedFeatureIds.clear();
    this._selectedFeatureIds.add(id);
    this._syncSelectionState();
  }

  public clearSelection() {
    this._selectedFeatureIds.clear();
    this._syncSelectionState();
  }

  private _syncSelectionState() {
    let changed = false;
    const updatedFeatures: Feature[] = [];

    for (const [id, feature] of this._featureMap.entries()) {
      const f = feature as ShapeFeature;
      const selected = this._selectedFeatureIds.has(id);
      if (f.properties.selected !== selected) {
        const updated: ShapeFeature = {
          ...f,
          properties: { ...f.properties, selected },
        };
        this._featureMap.set(id, updated);
        updatedFeatures.push(updated);
        changed = true;
      }
    }

    if (changed) {
      this._invalidateCache();
      this._emit("selection:change", { selectedIds: this.selectedIds });
      this._emit("feature:update", { features: updatedFeatures });
      this._emit("feature:change", { features: this.features });
    }
  }
}
