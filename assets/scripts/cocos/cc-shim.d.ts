declare module "cc" {
  export namespace _decorator {
    function ccclass(name: string): ClassDecorator;
    function property(type?: unknown): PropertyDecorator;
  }

  export class Component {
    node: Node;
  }

  export class Node {
    constructor(name?: string);
    name: string;
    children: Node[];
    active: boolean;
    addChild(child: Node): void;
    addComponent<T>(component: new (...args: never[]) => T): T;
    on(type: string, callback: () => void, target?: unknown): void;
    setPosition(x: number, y: number, z?: number): void;
  }

  export class Label extends Component {
    string: string;
    fontSize: number;
    lineHeight: number;
    color: Color;
    horizontalAlign: number;
  }

  export class JsonAsset {
    json: unknown;
  }

  export class Color {
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
