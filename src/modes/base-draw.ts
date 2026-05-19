import type { DrawMode, DrawInfo, EditContext } from "../core";
import { DrawController } from "../core";
import type { Feature, Position } from "geojson";

export interface BaseDrawModeConfig {
  pointCount?: number;
  controlPointDisplay?: "none" | "first" | "last" | "first-last" | "all";
}

export interface BaseDrawModeOptions extends BaseDrawModeConfig {
  properties?: Record<string, unknown>;
}

export abstract class BaseDrawMode implements DrawMode {
  abstract name: string;

  protected config: BaseDrawModeConfig;
  protected coordinates: Position[] = [];
  protected featureIds: (string | number)[] = [];
  public properties?: Record<string, unknown>;

  constructor(options: BaseDrawModeOptions = {}) {
    const { properties, ...config } = options;
    this.config = config;
    this.properties = properties;
  }

  onEnter(draw: DrawController) {
    draw.setCursor("crosshair");

    if (!this.config.pointCount || this.config.pointCount > 1) {
      draw.setDoubleClickZoom(false);
    }
  }

  onExit(draw: DrawController) {
    this.reset(draw);
  }

  onClick(info: DrawInfo, draw: DrawController) {
    const coord: Position = [info.lng, info.lat];

    if (info.feature?.properties?.controlPoint) {
      this.finishShape(draw);
      return;
    }

    this.coordinates.push(coord);

    if (this.coordinates.length === 1) {
      this.createInitialFeature(draw, coord);
      if (!this.config.pointCount || this.config.pointCount > 1) return;
    }

    if (this.config.pointCount && this.coordinates.length >= this.config.pointCount) {
      this.finishShape(draw);
      return;
    }

    this.updateShape(draw, this.coordinates, { preview: true });
    this.updateControlPoints(draw);
  }

  onDoubleClick(_info: DrawInfo, draw: DrawController) {
    this.finishShape(draw);
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (this.featureIds.length === 0 || this.coordinates.length === 0) return;
    const previewCoords = [...this.coordinates, [info.lng, info.lat]];
    this.updateShape(draw, previewCoords, { preview: true });
  }

  abstract generate(
    draw: DrawController,
    points: Position[],
    id?: string | number | (string | number)[],
    props?: Record<string, unknown>,
  ): Feature | Feature[] | undefined;

  edit({ controlPoints, controlPointIndex, delta }: EditContext): Position[] {
    const [dx, dy] = delta;
    return controlPoints.map((coord, i) => (i === controlPointIndex ? [coord[0] + dx, coord[1] + dy] : coord));
  }

  public createFeature(draw: DrawController, points: Position[], props?: Record<string, unknown>): Feature | Feature[] | undefined {
    const mergedProps = { ...this.properties, ...props };
    const result = this.generate(draw, points, undefined, mergedProps);
    if (!result) return undefined;

    const features = Array.isArray(result) ? result : [result];
    draw.state.addFeatures(features);

    return result;
  }

  protected createInitialFeature(draw: DrawController, coord: Position) {
    const initialCoords = this.config.pointCount === 1 ? [coord] : [coord, coord];
    const result = this.generate(draw, initialCoords, undefined, this.properties);
    if (!result) return;

    const features = Array.isArray(result) ? result : [result];
    this.featureIds = features.map(f => f.id!).filter(id => id !== undefined);
    draw.state.addFeatures(features);

    // Store control points in state
    const primaryId = this.getPrimaryFeatureId(draw);
    if (primaryId) {
      draw.state.setControlPoints(primaryId, initialCoords);
    }

    if (this.featureIds.length > 0) this.updateControlPoints(draw);
  }

  protected updateShape(draw: DrawController, coords: Position[], props?: Record<string, unknown>) {
    if (this.featureIds.length === 0) return;
    const mergedProps = { ...this.properties, ...props };

    // Pass single ID for backward compatibility, or array for grouped features
    const idArg = this.featureIds.length === 1 ? this.featureIds[0] : this.featureIds;
    const result = this.generate(draw, coords, idArg, mergedProps);
    if (!result) return;

    const features = Array.isArray(result) ? result : [result];
    features.forEach(feature => {
      if (feature.id !== undefined) {
        draw.state.updateFeature(feature.id, feature);
      }
    });

    // Update control points in state
    const primaryId = this.getPrimaryFeatureId(draw);
    if (primaryId) {
      draw.state.setControlPoints(primaryId, coords);
    }
  }

  protected updateControlPoints(draw: DrawController) {
    const primaryId = this.getPrimaryFeatureId(draw);
    if (!primaryId || this.coordinates.length === 0) return;

    // Clear control points for all features in the group to avoid overlapping
    this.featureIds.forEach(id => draw.state.clearControlPoints(id));

    const { controlPointDisplay = "all" } = this.config;
    const coords = this.coordinates;
    switch (controlPointDisplay) {
      case "none":
        return;

      case "first":
        draw.state.createControlPoint(primaryId, coords[0], 0);
        break;

      case "last":
        draw.state.createControlPoint(primaryId, coords[coords.length - 1], 0);
        break;

      case "first-last":
        draw.state.createControlPoint(primaryId, coords[0], 0);
        if (coords.length > 1) {
          draw.state.createControlPoint(primaryId, coords[coords.length - 1], 1);
        }
        break;

      case "all":
      default:
        coords.forEach((coord, i) => {
          draw.state.createControlPoint(primaryId!, coord, i);
        });
        break;
    }
  }

  protected getPrimaryFeatureId(draw: DrawController): string | number | undefined {
    // Find the primary feature (one with groupPrimary: true, or the first one)
    for (const id of this.featureIds) {
      const feature = draw.state.getFeature(id);
      if (feature?.properties?.groupPrimary) return id;
    }
    return this.featureIds[0];
  }

  protected finishShape(draw: DrawController) {
    if (this.featureIds.length === 0) return;
    this.updateShape(draw, this.coordinates, { preview: false });
    // Clear control points for all features in the group
    this.featureIds.forEach(id => draw.state.clearControlPoints(id));
    this.reset(draw);
  }

  protected reset(draw: DrawController) {
    // Clear control points for all features in the group
    this.featureIds.forEach(id => draw.state.clearControlPoints(id));
    this.coordinates = [];
    this.featureIds = [];
  }
}
