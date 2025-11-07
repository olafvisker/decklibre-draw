import { DrawInfo, DrawMode } from '../draw-mode';
import { DrawController } from '../draw-controller';
interface DirectSelectModeOptions {
    selectedId?: string | number;
    dragWithoutSelect?: boolean;
}
export declare class DirectSelectMode implements DrawMode {
    private _startSelectedId?;
    private _dragging;
    private _dragType;
    private _dragStartCoord?;
    private _dragWithoutSelect;
    private _dragFeatureId?;
    private _dragHandleIndex?;
    constructor({ selectedId, dragWithoutSelect }?: DirectSelectModeOptions);
    onEnter(draw: DrawController): void;
    onExit(draw: DrawController): void;
    onClick(info: DrawInfo, draw: DrawController): void;
    onMouseDown(info: DrawInfo, draw: DrawController): void;
    onMouseMove(info: DrawInfo, draw: DrawController): void;
    onMouseUp(info: DrawInfo, draw: DrawController): void;
    private resetDragState;
    private startDrag;
    private translateFeature;
    private moveVertex;
    private insertVertex;
    private createHandles;
    private makeMidpoints;
    private makeMidpoint;
    private deselectAll;
    private getSelectedFeature;
    private regenerateFeature;
}
export {};
