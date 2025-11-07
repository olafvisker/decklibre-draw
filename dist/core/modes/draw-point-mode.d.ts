import { DrawInfo, DrawMode } from '../draw-mode';
import { DrawController } from '../draw-controller';
export declare class DrawPointMode implements DrawMode {
    onEnter(draw: DrawController): void;
    onClick(info: DrawInfo, draw: DrawController): void;
}
