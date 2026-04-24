declare module "cc" {
  export namespace _decorator {
    function ccclass(name: string): ClassDecorator;
    function property(type?: unknown): PropertyDecorator;
  }

  export class Component {
    node: Node;
  }

  export class Node {
    name: string;
    children: Node[];
    active: boolean;
    addChild(child: Node): void;
  }

  export class Label {
    string: string;
  }

  export class JsonAsset {
    json: unknown;
  }

  export const resources: {
    load<T>(
      path: string,
      type: new (...args: never[]) => T,
      onComplete: (error: Error | null, asset: T | null) => void
    ): void;
  };
}
