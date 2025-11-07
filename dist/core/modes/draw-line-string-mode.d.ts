import { DrawInfo, DrawMode } from '../draw-mode';
import { DrawController } from '../draw-controller';
export declare class DrawLineStringMode implements DrawMode {
    private coordinates;
    private lineId?;
    onEnter(draw: DrawController): void;
    onExit(draw: DrawController): void;
    onClick(info: DrawInfo, draw: DrawController): void;
    onDoubleClick(_info: DrawInfo, draw: DrawController): void;
    onMouseMove(info: DrawInfo, draw: DrawController): void;
    private updateLine;
    private updateHandles;
    private finishLine;
    private reset;
}
