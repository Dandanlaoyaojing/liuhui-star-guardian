declare module "cc" {
  export namespace _decorator {
    function ccclass(name: string): ClassDecorator;
    function property(type?: unknown): PropertyDecorator;
  }

  export const CCBoolean: BooleanConstructor;

  export class Component {
    node: Node;
  }

  export class Node {
    constructor(name?: string);
    name: string;
    children: Node[];
    active: boolean;
    position: { x: number; y: number; z?: number };
    addChild(child: Node): void;
    addComponent<T>(component: new (...args: never[]) => T): T;
    destroy(): void;
    on(type: string, callback: (event: EventTouch) => void, target?: unknown): void;
    setPosition(x: number, y: number, z?: number): void;
    setRotationFromEuler(x: number, y: number, z: number): void;
  }

  export class EventTouch {
    getID(): number;
    getUILocation(): { x: number; y: number };
    getScrollY?(): number;
  }

  export const Input: {
    EventType: {
      MOUSE_DOWN: string;
      MOUSE_MOVE: string;
      MOUSE_UP: string;
      MOUSE_WHEEL: string;
      TOUCH_START: string;
      TOUCH_MOVE: string;
      TOUCH_END: string;
      TOUCH_CANCEL: string;
    };
  };

  export const input: {
    on(type: string, callback: (event: EventTouch) => void, target?: unknown): void;
    off(type: string, callback: (event: EventTouch) => void, target?: unknown): void;
  };

  export class Label extends Component {
    string: string;
    fontSize: number;
    lineHeight: number;
    color: Color;
    horizontalAlign: number;
  }

  export class Sprite extends Component {
    color: Color;
    spriteFrame: SpriteFrame | null;
    sizeMode: Sprite.SizeMode;
  }

  export namespace Sprite {
    export enum SizeMode {
      CUSTOM = 0,
      TRIMMED = 1,
      RAW = 2
    }
  }

  export class SpriteFrame {}

  export class JsonAsset {
    json: unknown;
  }

  export class Color {
    r: number;
    g: number;
    b: number;
    a: number;
    constructor(r?: number, g?: number, b?: number, a?: number);
  }

  export class Graphics extends Component {
    lineWidth: number;
    strokeColor: Color;
    fillColor: Color;
    clear(): void;
    circle(x: number, y: number, r: number): void;
    rect(x: number, y: number, width: number, height: number): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    close(): void;
    fill(): void;
    stroke(): void;
  }

  export class UITransform extends Component {
    setContentSize(width: number, height: number): void;
  }

  export const resources: {
    load<T>(
      path: string,
      type: new (...args: never[]) => T,
      onComplete: (error: Error | null, asset: T | null) => void
    ): void;
  };
}
