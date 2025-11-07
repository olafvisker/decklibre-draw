import { DrawInfo, DrawMode } from '../draw-mode';
import { DrawController } from '../draw-controller';
export declare class DrawCircleMode implements DrawMode {
    private center?;
    private circleId?;
    onEnter(draw: DrawController): void;
    onExit(draw: DrawController): void;
    onClick(info: DrawInfo, draw: DrawController): void;
    onMouseMove(info: DrawInfo, draw: DrawController): void;
    private updateCircle;
    private reset;
    private withDefaultProps;
}
