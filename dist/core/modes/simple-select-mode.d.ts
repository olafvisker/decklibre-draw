import { DrawController } from '../draw-controller';
import { DrawInfo, DrawMode } from '../draw-mode';
interface SimpleSelectModeOptions {
    selectedId?: string | number;
    dragWithoutSelect?: boolean;
}
export declare class SimpleSelectMode implements DrawMode {
    private _startSelectedId;
    private _dragging;
    private _dragWithoutSelect;
    private _dragStartCoord?;
    private _dragFeatureId?;
    constructor({ selectedId, dragWithoutSelect }?: SimpleSelectModeOptions);
    onEnter(draw: DrawController): void;
    onExit(draw: DrawController): void;
    onClick(info: DrawInfo, draw: DrawController): void;
    onMouseDown(info: DrawInfo, draw: DrawController): void;
    onMouseMove(info: DrawInfo, draw: DrawController): void;
    onMouseUp(_info: DrawInfo, draw: DrawController): void;
    private translateFeature;
}
export {};
