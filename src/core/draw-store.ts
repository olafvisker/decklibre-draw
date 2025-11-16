import type { Feature, GeoJsonProperties, Geometry, Point, Position } from "geojson";
import { v4 as uuid } from "uuid";
import mitt from "mitt";
import { DrawStoreEvents } from "./draw-events";
import { DrawController } from "./draw-controller";

export type DrawFeature = Feature<Geometry, DrawProperties>;
export type HandleFeature = Feature<Point, HandleProperties>;

export type DrawProperties = GeoJsonProperties & {
  mode: string;
  handles: Position[];
  preview?: boolean;
  selected?: boolean;
};

export type HandleProperties = GeoJsonProperties & {
  handle?: boolean;
  midpoint?: boolean;
  featureId: string | number;
  index: number;
};

export interface GenerateFeatureOptions<P extends GeoJsonProperties = GeoJsonProperties> {
  id?: string | number;
  props?: P;
  shapeGeneratorOptions?: Record<string, unknown>;
}

export interface DrawStoreOptions {
  features?: Feature[];
}

export class DrawStore {
  private _draw: DrawController;
  private _emitter = mitt<DrawStoreEvents>();

  private _featureMap: Map<string | number, Feature> = new Map();
  private _handleMap: Map<string | number, HandleFeature[]> = new Map();
  private _selectedFeatureIds = new Set<string | number>();

  constructor(draw: DrawController, options?: DrawStoreOptions) {
    this._draw = draw;
    if (options?.features) this.addFeatures(options.features);
  }

  public on = this._emitter.on;
  public off = this._emitter.off;
  private _emit = this._emitter.emit;

  // --- Feature Management ---
  public get features(): Feature[] {
    return Array.from(this._featureMap.values());
  }

  public getFeature(id: string | number) {
    return this._featureMap.get(id);
  }

  public addFeature(feature: Feature) {
    this.addFeatures([feature]);
  }

  public addFeatures(features: Feature[]) {
    const added: Feature[] = [];
    if (!features.length) return;
    for (const f of features) {
      if (f.id === undefined) continue;
      this._featureMap.set(f.id!.toString(), f);
      added.push(f);
    }
    this._emit("feature:add", { features: added });
    this._emit("feature:change", { features: this.features });
  }

  public removeFeature(id: string | number) {
    return this.removeFeatures([id]);
  }

  public removeFeatures(ids: (string | number)[]) {
    if (!ids.length) return;
    for (const id of ids) {
      this._featureMap.delete(id);
      this._selectedFeatureIds.delete(id);
      this.clearHandles(id);
    }
    this._emit("feature:remove", { ids });
    this._emit("feature:change", { features: this.features });
  }

  public removeAllFeature() {
    const ids = Array.from(this._featureMap.keys());
    for (const featureId of this._handleMap.keys()) {
      this.clearHandles(featureId);
    }
    this._featureMap.clear();
    this._selectedFeatureIds.clear();
    this._emit("feature:remove", { ids });
    this._emit("feature:change", { features: this.features });
  }

  public updateFeature(id: string | number, updates: Partial<Feature>) {
    const feature = this._featureMap.get(id);
    if (!feature) return;
    Object.assign(feature, updates);
    this._emit("feature:update", { features: [feature] });
    this._emit("feature:change", { features: this.features });
  }

  /** Generator */
  public generateFeature(name: string, points: Position[], options?: GenerateFeatureOptions) {
    const generator = this._draw.getGenerator(name);
    const feature = generator?.(this._draw, points, options?.shapeGeneratorOptions);
    if (!feature) return;
    feature.id = options?.id || feature.id || uuid();
    feature.properties = {
      ...feature.properties,
      mode: "",
      generator: name,
      handles: points,
      ...options?.props,
    } as DrawProperties;
    return feature;
  }

  // --- Control Point Management ---
  public createHandle(
    featureId: string | number,
    coord: Position,
    index: number,
    asMidpoint: boolean = false
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
      this.removeFeatures(handle.map((h) => h.id!.toString()));
      this._handleMap.delete(featureId);
    }
  }

  public getHandles(featureId: string | number) {
    return this._handleMap.get(featureId) ?? [];
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

    // Update selected features
    for (const id of this._selectedFeatureIds) {
      const feature = this._featureMap.get(id) as DrawFeature;
      if (feature && feature.properties.selected !== true) {
        feature.properties.selected = true;
        changed = true;
      }
    }

    // Update unselected features
    for (const f of this._featureMap.values()) {
      const feature = f as DrawFeature;
      if (feature.properties.selected && !this._selectedFeatureIds.has(feature.id!.toString())) {
        feature.properties.selected = false;
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
