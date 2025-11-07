import { DrawInfo, DrawMode } from '../draw-mode';
import { DrawController } from '../draw-controller';
export declare class DrawRectangleMode implements DrawMode {
    private start?;
    private rectId?;
    onEnter(draw: DrawController): void;
    onExit(draw: DrawController): void;
    onClick(info: DrawInfo, draw: DrawController): void;
    onMouseMove(info: DrawInfo, draw: DrawController): void;
    private updateRect;
    private reset;
    private withDefaultProps;
}
