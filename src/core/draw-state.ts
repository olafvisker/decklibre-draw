import type { Feature, GeoJsonProperties, Geometry, Point, Position } from "geojson";
import { v4 as uuid } from "uuid";
import mitt from "mitt";

export type ShapeFeatureProperties = GeoJsonProperties & {
  mode: string;
  preview?: boolean;
  selected?: boolean;
};

export type ControlPointFeatureProperties = GeoJsonProperties & {
  controlPoint?: boolean;
  midpoint?: boolean;
  featureId: string | number;
  index: number;
};

export type DrawFeatureProperties = Partial<ShapeFeatureProperties & ControlPointFeatureProperties> | null;

export type DrawFeature = Feature<Geometry, DrawFeatureProperties>;
export type ShapeFeature = Feature<Geometry, ShapeFeatureProperties>;
export type ControlPointFeature = Feature<Point, ControlPointFeatureProperties>;

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
  private _controlPointsMap: Map<string | number, Position[]> = new Map();
  private _controlPointFeaturesMap: Map<string | number, ControlPointFeature[]> = new Map();
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

    // Check if this is a control point feature (has control point-specific properties)
    const isControlPoint =
      feature.properties &&
      ("controlPoint" in feature.properties || "midpoint" in feature.properties || "featureId" in feature.properties);

    // If it's not a control point and missing shape properties, add defaults
    if (!isControlPoint) {
      const props = (feature.properties || {}) as Partial<ShapeFeatureProperties>;
      if (!props.mode) {
        feature.properties = {
          ...props,
          mode: props.mode ?? "simple",
        };
      }
    }

    return feature;
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
      this.clearControlPoints(id, options);
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
    for (const featureId of this._controlPointFeaturesMap.keys()) {
      this.clearControlPoints(featureId, options);
    }
    const hadSelection = this._selectedFeatureIds.size > 0;
    this._featureMap.clear();
    this._controlPointsMap.clear();
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

  // --- Control Points Management ---
  private _extractControlPointsFromGeometry(geometry: Geometry): Position[] {
    if (!geometry) return [];

    switch (geometry.type) {
      case "Point":
        return [geometry.coordinates];
      case "LineString":
        return geometry.coordinates;
      case "Polygon":
        // Return the outer ring without the closing point
        const ring = geometry.coordinates[0] || [];
        return ring.length > 0 ? ring.slice(0, -1) : [];
      default:
        return [];
    }
  }

  public getControlPoints(featureId: string | number): Position[] | undefined {
    // If control points are already stored, return them
    const stored = this._controlPointsMap.get(featureId);
    if (stored) return stored;

    // Otherwise, extract from geometry and store
    const feature = this._featureMap.get(featureId);
    if (feature && feature.geometry) {
      const extracted = this._extractControlPointsFromGeometry(feature.geometry);
      if (extracted.length > 0) {
        this._controlPointsMap.set(featureId, extracted);
        return extracted;
      }
    }

    return undefined;
  }

  public setControlPoints(featureId: string | number, points: Position[]) {
    this._controlPointsMap.set(featureId, points);
  }

  public clearControlPointsData(featureId: string | number) {
    this._controlPointsMap.delete(featureId);
  }

  public createControlPoint(
    featureId: string | number,
    coord: Position,
    index: number,
    asMidpoint: boolean = false,
  ): ControlPointFeature {
    const controlPoint: ControlPointFeature = {
      id: uuid(),
      type: "Feature",
      geometry: { type: "Point", coordinates: coord },
      properties: { controlPoint: !asMidpoint, midpoint: asMidpoint, featureId, index },
    };

    const existing = this._controlPointFeaturesMap.get(featureId) ?? [];
    this._controlPointFeaturesMap.set(featureId, [...existing, controlPoint]);
    this.addFeature(controlPoint);
    return controlPoint;
  }

  public clearControlPoints(featureId: string | number, options?: DrawStateMethodOptions) {
    const controlPoints = this._controlPointFeaturesMap.get(featureId);
    if (controlPoints) {
      this.removeFeatures(
        controlPoints.map((cp) => cp.id!),
        options,
      );
      this._controlPointFeaturesMap.delete(featureId);
    }
  }

  public getControlPointFeatures(featureId: string | number) {
    return this._controlPointFeaturesMap.get(featureId) ?? [];
  }

  public updateControlPoint(controlPointId: string | number, coord: Position, options?: DrawStateMethodOptions) {
    const controlPoint = this._featureMap.get(controlPointId) as ControlPointFeature;
    if (!controlPoint) return;

    const updated: ControlPointFeature = {
      ...controlPoint,
      geometry: { type: "Point", coordinates: coord },
    };

    this._featureMap.set(controlPointId, updated);

    // Update in control point map
    const featureId = controlPoint.properties.featureId;
    const controlPoints = this._controlPointFeaturesMap.get(featureId);
    if (controlPoints) {
      const index = controlPoints.findIndex((cp) => cp.id === controlPointId);
      if (index !== -1) {
        controlPoints[index] = updated;
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
