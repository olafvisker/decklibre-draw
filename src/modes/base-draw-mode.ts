import { DrawMode, DrawController, DrawInfo } from "../core";
import type { Position } from "geojson";

export interface BaseDrawModeConfig {
  generator: {
    name: string;
    options?: Record<string, unknown>;
  };
  pointCount?: number;
  handleDisplay?: "none" | "first" | "last" | "first-last" | "all";
  featureProps?: Record<string, unknown>;
}

export class BaseDrawMode implements DrawMode {
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

    this.updateShape(draw, this.coordinates, { selected: true });
    this.updateHandles(draw);
  }

  onDoubleClick(_info: DrawInfo, draw: DrawController) {
    this.finishShape(draw);
  }

  onMouseMove(info: DrawInfo, draw: DrawController) {
    if (!this.featureId || this.coordinates.length === 0) return;
    const previewCoords = [...this.coordinates, [info.lng, info.lat]];
    this.updateShape(draw, previewCoords, { selected: true });
  }

  protected createInitialFeature(draw: DrawController, coord: Position) {
    const initialCoords = this.config.pointCount === 1 ? [coord] : [coord, coord];
    const feature = draw.store.generateFeature(this.config.generator.name, initialCoords, {
      props: {
        selected: true,
        ...this.config.featureProps,
      },
      shapeGeneratorOptions: this.config.generator.options,
    });

    if (!feature) return;

    this.featureId = feature.id;
    draw.store.addFeature(feature);

    if (this.featureId) {
      draw.store.createHandle(this.featureId, coord);
    }
  }

  protected updateShape(draw: DrawController, coords: Position[], props?: Record<string, unknown>) {
    if (!this.featureId) return;

    const feature = draw.store.generateFeature(this.config.generator.name, coords, {
      id: this.featureId,
      props: {
        ...this.config.featureProps,
        ...props,
      },
      shapeGeneratorOptions: this.config.generator.options,
    });

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
        draw.store.createHandle(this.featureId, coords[0]);
        break;

      case "last":
        draw.store.createHandle(this.featureId, coords[coords.length - 1]);
        break;

      case "first-last":
        draw.store.createHandle(this.featureId, coords[0]);
        if (coords.length > 1) {
          draw.store.createHandle(this.featureId, coords[coords.length - 1]);
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
    this.updateShape(draw, this.coordinates, { selected: false });
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

// Concrete mode classes for common shapes
export class DrawPointMode extends BaseDrawMode {
  constructor() {
    super({
      generator: { name: "point" },
      pointCount: 1,
    });
  }
}

export class DrawLineStringMode extends BaseDrawMode {
  constructor() {
    super({
      generator: { name: "line" },
      handleDisplay: "last",
    });
  }
}

export class DrawPolygonMode extends BaseDrawMode {
  constructor() {
    super({
      generator: { name: "polygon" },
      handleDisplay: "first-last",
    });
  }
}

export class DrawCircleMode extends BaseDrawMode {
  constructor({ geodesic = true }: { geodesic?: boolean } = {}) {
    super({
      generator: { name: "circle", options: { geodesic } },
      pointCount: 2,
      handleDisplay: "first",
      featureProps: { insertable: false },
    });
  }
}

export class DrawRectangleMode extends BaseDrawMode {
  constructor() {
    super({
      generator: { name: "rect" },
      pointCount: 2,
      handleDisplay: "first",
      featureProps: { insertable: false },
    });
  }
}
