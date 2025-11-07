import { DrawInfo, DrawMode } from '../draw-mode';
import { DrawController } from '../draw-controller';
export declare class DrawPolygonMode implements DrawMode {
    private coordinates;
    private polygonId?;
    onEnter(draw: DrawController): void;
    onExit(draw: DrawController): void;
    onClick(info: DrawInfo, draw: DrawController): void;
    onDoubleClick(_info: DrawInfo, draw: DrawController): void;
    onMouseMove(info: DrawInfo, draw: DrawController): void;
    private updatePolygon;
    private updateHandles;
    private finishPolygon;
    private reset;
}
