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

export interface DrawStateMethodOptions {
  silent?: boolean;
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

  private _normalizeFeature(f: Feature): DrawFeature {
    const feature = { ...f, id: f.id ?? uuid() } as DrawFeature;

    // Check if this is a handle feature (has handle-specific properties)
    const isHandle =
      feature.properties &&
      ("handle" in feature.properties || "midpoint" in feature.properties || "featureId" in feature.properties);

    // If it's not a handle and missing shape properties, add defaults
    if (!isHandle) {
      const props = (feature.properties || {}) as Partial<ShapeFeatureProperties>;
      if (!props.mode || !props.handles) {
        const handles = this._extractHandles(feature.geometry);
        feature.properties = {
          ...props,
          mode: props.mode ?? "simple",
          handles: props.handles ?? handles,
        };
      }
    }

    return feature;
  }

  private _extractHandles(geometry: Geometry): Position[] {
    if (!geometry) return [];

    switch (geometry.type) {
      case "Point":
        return [geometry.coordinates];
      case "LineString":
        return geometry.coordinates;
      case "Polygon":
        return geometry.coordinates[0] || [];
      default:
        return [];
    }
  }

  public addFeature(feature: Feature, options?: DrawStateMethodOptions) {
    this.addFeatures([feature], options);
  }

  public addFeatures(features: Feature[], options?: DrawStateMethodOptions) {
    const added: DrawFeature[] = [];
    if (!features.length) return;
    for (const f of features) {
      const feature = this._normalizeFeature(f);
      this._featureMap.set(feature.id!, feature);
      added.push(feature);
    }
    this._invalidateCache();
    if (!options?.silent) {
      this._emit("feature:add", { features: added });
      this._emit("feature:change", { features: this.features });
    }
  }

  public removeFeature(id: string | number, options?: DrawStateMethodOptions) {
    return this.removeFeatures([id], options);
  }

  public removeFeatures(ids: (string | number)[], options?: DrawStateMethodOptions) {
    if (!ids.length) return;
    let selectionChanged = false;
    for (const id of ids) {
      this._featureMap.delete(id);
      if (this._selectedFeatureIds.delete(id)) {
        selectionChanged = true;
      }
      this.clearHandles(id, options);
    }
    this._invalidateCache();
    if (!options?.silent) {
      this._emit("feature:remove", { ids });
      this._emit("feature:change", { features: this.features });
      if (selectionChanged) this._emit("selection:change", { selectedIds: this.selectedIds });
    }
  }

  public removeAllFeature(options?: DrawStateMethodOptions) {
    const ids = Array.from(this._featureMap.keys());
    for (const featureId of this._handleMap.keys()) {
      this.clearHandles(featureId, options);
    }
    const hadSelection = this._selectedFeatureIds.size > 0;
    this._featureMap.clear();
    this._selectedFeatureIds.clear();
    this._invalidateCache();

    if (!options?.silent) {
      this._emit("feature:remove", { ids });
      this._emit("feature:change", { features: this.features });
      if (hadSelection) this._emit("selection:change", { selectedIds: [] });
    }
  }

  public updateFeature(id: string | number, updates: Partial<Feature>, options?: DrawStateMethodOptions) {
    const feature = this._featureMap.get(id);
    if (!feature) return;

    // Create new feature object instead of mutating
    const updated = { ...feature, ...updates };
    if (updates.properties && feature.properties) {
      updated.properties = { ...feature.properties, ...updates.properties };
    }

    this._featureMap.set(id, updated);
    this._invalidateCache();
    if (!options?.silent) {
      this._emit("feature:update", { features: [updated] });
      this._emit("feature:change", { features: this.features });
    }
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

  public clearHandles(featureId: string | number, options?: DrawStateMethodOptions) {
    const handle = this._handleMap.get(featureId);
    if (handle) {
      this.removeFeatures(
        handle.map((h) => h.id!),
        options,
      );
      this._handleMap.delete(featureId);
    }
  }

  public getHandles(featureId: string | number) {
    return this._handleMap.get(featureId) ?? [];
  }

  public updateHandle(handleId: string | number, coord: Position, options?: DrawStateMethodOptions) {
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
    if (!options?.silent) {
      this._emit("feature:update", { features: [updated] });
      this._emit("feature:change", { features: this.features });
    }
  }

  // --- Selection Management ---
  public get selectedIds(): (string | number)[] {
    return Array.from(this._selectedFeatureIds);
  }

  public isSelected(id: string | number): boolean {
    return this._selectedFeatureIds.has(id);
  }

  public setSelected(id: string | number, options?: DrawStateMethodOptions) {
    this._selectedFeatureIds.clear();
    this._selectedFeatureIds.add(id);
    this._syncSelectionState(options);
  }

  public clearSelection(options?: DrawStateMethodOptions) {
    this._selectedFeatureIds.clear();
    this._syncSelectionState(options);
  }

  private _syncSelectionState(options?: DrawStateMethodOptions) {
    let changed = false;
    const updatedFeatures: Feature[] = [];

    // Collect all groupIds from selected features
    const selectedGroupIds = new Set<string | number>();
    for (const id of this._selectedFeatureIds) {
      const feature = this._featureMap.get(id) as ShapeFeature | undefined;
      if (feature?.properties?.groupId) {
        selectedGroupIds.add(feature.properties.groupId);
      }
    }

    for (const [id, feature] of this._featureMap.entries()) {
      const f = feature as ShapeFeature;
      // A feature is selected if its ID is selected OR its groupId matches a selected group
      const isDirectlySelected = this._selectedFeatureIds.has(id);
      const isInSelectedGroup = f.properties?.groupId && selectedGroupIds.has(f.properties.groupId);
      const selected = isDirectlySelected || isInSelectedGroup;

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
      if (!options?.silent) {
        this._emit("selection:change", { selectedIds: this.selectedIds });
        this._emit("feature:update", { features: updatedFeatures });
        this._emit("feature:change", { features: this.features });
      }
    }
  }
}
