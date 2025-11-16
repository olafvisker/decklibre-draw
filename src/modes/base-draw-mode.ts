import { DrawMode, DrawController, DrawInfo, EditContext } from "../core";
import { isolatedEditor } from "../editors";
import type { Feature, Position } from "geojson";

export interface BaseDrawModeConfig {
  pointCount?: number;
  handleDisplay?: "none" | "first" | "last" | "first-last" | "all";
}

export abstract class BaseDrawMode implements DrawMode {
  abstract readonly name: string;

  protected config: BaseDrawModeConfig;
  protected coordinates: Position[] = [];
  protected featureId?: string | number;

  constructor(config: BaseDrawModeConfig) {
    this.config = config;
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

    if (info.feature?.properties?.handle) {
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
    this.updateHandles(draw);
  }

  onDoubleClick(_info: DrawInfo, draw: DrawController) {
    this.finishShape(draw);
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (!this.featureId || this.coordinates.length === 0) return;
    const previewCoords = [...this.coordinates, [info.lng, info.lat]];
    this.updateShape(draw, previewCoords, { preview: true });
  }

  abstract generate(
    draw: DrawController,
    points: Position[],
    id?: string | number,
    props?: Record<string, unknown>
  ): Feature | undefined;

  edit(context: EditContext): Position[] {
    return isolatedEditor(context);
  }

  protected createInitialFeature(draw: DrawController, coord: Position) {
    const initialCoords = this.config.pointCount === 1 ? [coord] : [coord, coord];
    const feature = this.generate(draw, initialCoords);
    if (!feature) return;

    this.featureId = feature.id;
    draw.store.addFeature(feature);

    if (this.featureId) this.updateHandles(draw);
  }

  protected updateShape(draw: DrawController, coords: Position[], props?: Record<string, unknown>) {
    if (!this.featureId) return;
    const feature = this.generate(draw, coords, this.featureId, props);
    if (!feature) return;
    draw.store.updateFeature(this.featureId, feature);
  }

  protected updateHandles(draw: DrawController) {
    if (!this.featureId || this.coordinates.length === 0) return;

    draw.store.clearHandles(this.featureId);

    const { handleDisplay } = this.config;
    const coords = this.coordinates;
    switch (handleDisplay) {
      case "none":
        return;

      case "first":
        draw.store.createHandle(this.featureId, coords[0], 0);
        break;

      case "last":
        draw.store.createHandle(this.featureId, coords[coords.length - 1], 0);
        break;

      case "first-last":
        draw.store.createHandle(this.featureId, coords[0], 0);
        if (coords.length > 1) {
          draw.store.createHandle(this.featureId, coords[coords.length - 1], 1);
        }
        break;

      case "all":
        coords.forEach((coord, i) => {
          draw.store.createHandle(this.featureId!, coord, i);
        });
        break;
    }
  }

  protected finishShape(draw: DrawController) {
    if (!this.featureId) return;
    this.updateShape(draw, this.coordinates, { preview: false });
    draw.store.clearHandles(this.featureId);
    this.reset(draw);
  }

  protected reset(draw: DrawController) {
    if (this.featureId) {
      draw.store.clearHandles(this.featureId);
    }
    this.coordinates = [];
    this.featureId = undefined;
  }
}
