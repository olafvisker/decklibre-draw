import type { DrawMode, DrawInfo, EditContext, ShapeFeatureProperties } from "../core";
import { DrawController } from "../core";
import type { Feature, Position } from "geojson";

export interface BaseDrawModeConfig {
  pointCount?: number;
  controlPointDisplay?: "none" | "first" | "last" | "first-last" | "all";
}

export interface BaseDrawModeOptions extends BaseDrawModeConfig {
  properties?: Partial<ShapeFeatureProperties>;
}

export abstract class BaseDrawMode implements DrawMode {
  abstract name: string;

  protected config: BaseDrawModeConfig;
  protected coordinates: Position[] = [];
  protected featureIds: (string | number)[] = [];
  public properties?: Partial<ShapeFeatureProperties>;

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
      // For modes needing multiple points, create initial preview with duplicated coordinate
      const initialCoords = this.config.pointCount === 1 ? [coord] : [coord, coord];
      this.updateShape(draw, initialCoords, { preview: true });
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
    if (this.coordinates.length === 0) return;
    const previewCoords = [...this.coordinates, [info.lng, info.lat]];
    this.updateShape(draw, previewCoords, { preview: true });
  }

  abstract generate(
    draw: DrawController,
    points: Position[],
    ids?: (string | number)[],
    props?: Partial<ShapeFeatureProperties>,
  ): Feature[];

  edit({ controlPoints, controlPointIndex, delta }: EditContext): Position[] {
    const [dx, dy] = delta;
    return controlPoints.map((coord, i) => (i === controlPointIndex ? [coord[0] + dx, coord[1] + dy] : coord));
  }

  public createFeature(draw: DrawController, points: Position[], props?: Partial<ShapeFeatureProperties>): Feature[] {
    const mergedProps = { ...this.properties, ...props };
    const features = this.generate(draw, points, undefined, mergedProps);
    draw.state.addFeatures(features);

    // Store control points in state so they don't need to be extracted from geometry
    const primaryId = features[0]?.id;
    if (primaryId) {
      draw.state.setControlPoints(primaryId, points);
    }

    return features;
  }

  updateShape(draw: DrawController, coords: Position[], props?: Record<string, unknown>) {
    const mergedProps = { ...this.properties, ...props };
    const isInitialCreation = this.featureIds.length === 0;

    // Generate features (initial or update)
    const features = this.generate(draw, coords, isInitialCreation ? undefined : this.featureIds, mergedProps);
    const newIds = features.map((f) => f.id!).filter((id) => id !== undefined);

    if (isInitialCreation) {
      draw.state.addFeatures(features);
      this.featureIds = newIds;
    } else {
      const removedIds = this.featureIds.filter((id) => !newIds.includes(id));
      if (removedIds.length > 0) {
        draw.state.removeFeatures(removedIds);
      }

      const featuresToUpdate: Feature[] = [];
      const featuresToAdd: Feature[] = [];

      features.forEach((feature) => {
        if (feature.id !== undefined) {
          // Check if feature actually exists in the state
          if (draw.state.getFeature(feature.id)) {
            featuresToUpdate.push(feature);
          } else {
            featuresToAdd.push(feature);
          }
        }
      });

      // Update existing features
      featuresToUpdate.forEach((feature) => {
        draw.state.updateFeature(feature.id!, feature);
      });

      // Add new features
      if (featuresToAdd.length > 0) {
        draw.state.addFeatures(featuresToAdd);
      }

      this.featureIds = newIds.filter((id) => draw.state.getFeature(id) !== undefined);
    }

    // Update control points
    const primaryId = this.getPrimaryFeatureId();
    if (primaryId) {
      draw.state.setControlPoints(primaryId, coords);
    }

    this.syncFeatureIds(draw);
  }

  updateControlPoints(draw: DrawController) {
    const primaryId = this.getPrimaryFeatureId();
    if (!primaryId || this.coordinates.length === 0) return;

    // Clear control points for all features in the group to avoid overlapping
    this.featureIds.forEach((id) => draw.state.clearControlPoints(id));

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

  protected getPrimaryFeatureId(): string | number | undefined {
    // First feature is primary
    return this.featureIds[0];
  }

  protected syncFeatureIds(draw: DrawController): void {
    this.featureIds = this.featureIds.filter((id) => draw.state.getFeature(id) !== undefined);
  }

  finishShape(draw: DrawController) {
    this.updateShape(draw, this.coordinates, { preview: false });
    this.featureIds.forEach((id) => draw.state.clearControlPoints(id));
    this.syncFeatureIds(draw);
    this.reset(draw);
  }

  reset(draw: DrawController) {
    this.featureIds.forEach((id) => draw.state.clearControlPoints(id));
    this.coordinates = [];
    this.featureIds = [];
  }
}
