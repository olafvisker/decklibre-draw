import { Deck } from '@deck.gl/core';
import { Feature } from 'geojson';
import { DrawMode } from './draw-mode';
import { DrawStore, DrawStoreOptions } from './draw-store';
export type CursorState = "default" | "grab" | "grabbing" | "crosshair" | "pointer" | "wait" | "move";
export interface CursorOptions {
    default?: CursorState;
    hover?: CursorState;
    pan?: CursorState;
}
export interface DrawControllerOptions extends DrawStoreOptions {
    initialMode?: DrawMode | (new (options?: unknown) => DrawMode);
    layerIds?: string[];
}
export declare class DrawController {
    private _deck;
    private _map;
    private _mode?;
    private _store;
    private _layerIds;
    private _panning;
    private _modeInstances;
    constructor(deck: Deck, map: maplibregl.Map, options?: DrawControllerOptions);
    /** Getters */
    get features(): Feature[];
    get store(): DrawStore;
    /** Cleanup */
    destroy(): void;
    /** Mode handling */
    changeMode<M extends DrawMode, O extends ConstructorParameters<new (options?: unknown) => M>[0]>(modeOrInstance: (new (options?: O) => M) | M, options?: O): void;
    /** Cursor handling */
    setCursor(cursor: CursorState | CursorOptions): void;
    /** Deck/map helpers */
    setDraggability(enabled: boolean): void;
    setDoubleClickZoom(enabled: boolean): void;
    private _reset;
    /** Event binding */
    private _bindEvents;
    private _unbindEvents;
    /** Event handlers */
    /** Warm up deck.gl to avoid lazy init issues */
    private _warmUp;
    private _onMouseDown;
    private _onMouseMove;
    private _onMouseUp;
    private _onClick;
    private _onDoubleClick;
    private _onPanStart;
    private _onPanning;
    private _onPanEnd;
    private _buildInfo;
}
