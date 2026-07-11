declare module "cc" {
  export namespace _decorator {
    function ccclass(name: string): ClassDecorator;
    function property(type?: unknown): PropertyDecorator;
  }

  export const CCBoolean: BooleanConstructor;

  export const Layers: {
    Enum: { UI_2D: number; DEFAULT: number; [key: string]: number };
  };

  export class Component {
    node: Node;
    enabled: boolean;
  }

  export class Node {
    constructor(name?: string);
    name: string;
    children: Node[];
    active: boolean;
    layer: number;
    parent: Node | null;
    position: { x: number; y: number; z?: number };
    worldPosition: Vec3;
    eulerAngles: Vec3;
    readonly rotation: { x: number; y: number; z: number; w: number };
    addChild(child: Node): void;
    addComponent<T>(component: new (...args: never[]) => T): T;
    getComponent<T>(component: new (...args: never[]) => T): T | null;
    destroy(): void;
    getChildByName(name: string): Node | null;
    on(type: string, callback: (event: EventTouch) => void, target?: unknown): void;
    off(type: string, callback: (event: EventTouch) => void, target?: unknown): void;
    setPosition(x: number, y: number, z?: number): void;
    setWorldPosition(pos: Vec3): void;
    setRotationFromEuler(x: number, y: number, z: number): void;
    setScale(x: number, y?: number, z?: number): void;
    setSiblingIndex(index: number): void;
    static EventType: {
      TOUCH_START: string;
      TOUCH_MOVE: string;
      TOUCH_END: string;
      TOUCH_CANCEL: string;
    };
  }

  export class Vec3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    clone(): Vec3;
  }

  export function tween<T>(target: T): TweenAction<T>;
  export interface TweenAction<T> {
    to(
      duration: number,
      props: object,
      options?: { easing?: string; onUpdate?: (target: T, ratio: number) => void }
    ): TweenAction<T>;
    by(
      duration: number,
      props: object,
      options?: { easing?: string; onUpdate?: (target: T, ratio: number) => void }
    ): TweenAction<T>;
    call(cb: () => void): TweenAction<T>;
    delay(seconds: number): TweenAction<T>;
    start(): TweenAction<T>;
    stop(): TweenAction<T>;
  }

  export class EventTouch {
    getID(): number;
    getUILocation(): { x: number; y: number };
    getScrollY?(): number;
    propagationStopped: boolean; // 继承自引擎 Event; 置 true 阻止事件冒泡到祖先节点
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
    customMaterial: Material | null;
    /** 取该 sprite 的独立材质实例(从 customMaterial 派生); 逐 sprite 设 uniform 用。 */
    getMaterialInstance(index: number): Material | null;
  }

  export namespace Sprite {
    export enum SizeMode {
      CUSTOM = 0,
      TRIMMED = 1,
      RAW = 2
    }
  }

  export class SpriteFrame {
    /** 由 ImageAsset/Texture2D 直接造一帧(自动设满 rect); 运行时代码生成纹理时用。 */
    static createWithImage(imageOrTexture: ImageAsset | Texture2D): SpriteFrame;
    /** Asset name (frame filename without extension), e.g. "startle-00"; used to order loadDir frames. */
    name: string;
    /** 原始(未裁剪)尺寸,用于按真实宽高比设置 contentSize 防止变形 */
    getOriginalSize(): { width: number; height: number };
    /** 裁剪后内容区(含 x/y 偏移); 可读可写, 用底图+子 rect 切条带时需设置。 */
    rect: Rect;
    /** 底层贴图(整张图); 由它 + 子 rect 可切出条带 SpriteFrame。 */
    texture: Texture2D | null;
    /** 是否允许进动态图集; 运行时切的子帧设 false 避免打包后渲染异常。 */
    packable: boolean;
  }

  export class ImageAsset {
    constructor(source: {
      width: number;
      height: number;
      _data: ArrayBufferView | null;
      _compressed: boolean;
      format: number;
    });
  }

  export class Texture2D {
    static readonly PixelFormat: { readonly RGBA8888: number };
    image: ImageAsset | null;
  }

  export class EffectAsset {}

  export class Material {
    initialize(info: { effectAsset: EffectAsset | null }): void;
    setProperty(name: string, value: unknown): void;
  }

  export class Vec4 {
    constructor(x?: number, y?: number, z?: number, w?: number);
  }

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
    quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
    close(): void;
    fill(): void;
    stroke(): void;
  }

  export class UITransform extends Component {
    setContentSize(width: number, height: number): void;
    setAnchorPoint(x: number, y: number): void;
    /** 节点局部点 → 世界坐标(含父链缩放/旋转); 与 2D sprite 顶点世界空间一致。 */
    convertToWorldSpaceAR(nodePoint: Vec3, out?: Vec3): Vec3;
    /** 世界坐标 → 该节点局部点(convertToWorldSpaceAR 的逆); UI 命中测试把 getUILocation 当世界点传入。 */
    convertToNodeSpaceAR(worldPoint: Vec3, out?: Vec3): Vec3;
    readonly contentSize: { width: number; height: number };
    width: number;
    height: number;
  }

  export const resources: {
    load<T>(
      path: string,
      type: new (...args: never[]) => T,
      onComplete: (error: Error | null, asset: T | null) => void
    ): void;
    loadDir<T>(
      path: string,
      type: new (...args: never[]) => T,
      onComplete: (error: Error | null, assets: T[]) => void
    ): void;
  };

  export class Vec2 {
    x: number;
    y: number;
    constructor(x?: number, y?: number);
  }

  export class Size {
    width: number;
    height: number;
    constructor(width?: number, height?: number);
  }

  export class Rect {
    x: number;
    y: number;
    width: number;
    height: number;
    constructor(x?: number, y?: number, width?: number, height?: number);
  }

  export enum ERigidBody2DType {
    Static = 0,
    Kinematic = 1,
    Dynamic = 2,
    Animated = 3
  }

  export class RigidBody2D extends Component {
    type: ERigidBody2DType;
    gravityScale: number;
    allowSleep: boolean;
    linearDamping: number;
    angularDamping: number;
    bullet: boolean;
    linearVelocity: Vec2;
    angularVelocity: number;
    enabledContactListener: boolean;
  }

  export class BoxCollider2D extends Component {
    size: Size;
    offset: Vec2;
    friction: number;
    restitution: number;
    density: number;
    apply(): void;
  }

  export class CircleCollider2D extends Component {
    radius: number;
    friction: number;
    restitution: number;
    density: number;
    apply(): void;
  }

  export class PolygonCollider2D extends Component {
    points: Vec2[];
    friction: number;
    restitution: number;
    density: number;
    apply(): void;
  }

  export const PhysicsSystem2D: {
    instance: {
      enable: boolean;
      gravity: Vec2;
      fixedTimeStep: number;
      debugDrawFlags: number;
    };
  };

  export const game: {
    deltaTime: number;
    canvas?: HTMLCanvasElement;
  };

  /** 资产管理器: 通关过场帧序列播完后强制释放贴图内存(344 帧 RGBA 不释放会常驻)。 */
  export const assetManager: {
    releaseAsset(asset: unknown): void;
  };

  /** 音频资源导入后的资产类型(importer: audio-clip); 作 AudioSource.clip。 */
  export class AudioClip {}

  /** 音频播放组件(engine audio-source.ts, extends Component)。通关过场独立音轨用。 */
  export class AudioSource extends Component {
    clip: AudioClip | null;
    volume: number;
    loop: boolean;
    play(): void;
    stop(): void;
    playOneShot(clip: AudioClip, volumeScale?: number): void;
  }

  /** 平台/系统信息。os 取当前系统, 与 OS 枚举比对判 VideoPlayer 能力(原生桌面构建不编译)。 */
  export const sys: {
    readonly isNative: boolean;
    readonly os: string;
    readonly OS: {
      readonly IOS: string;
      readonly ANDROID: string;
      readonly WINDOWS: string;
      readonly OSX: string;
      readonly LINUX: string;
      readonly UNKNOWN: string;
    };
  };

  /** mp4 等视频资源导入后的资产类型(importer: video-clip); 作 VideoPlayer.clip。 */
  export class VideoClip {}

  /**
   * 原生视频播放组件(engine video-player.ts, extends Component)。iOS/Android/Web 走原生 AVPlayer/
   * DOM video, 内存极省; 原生桌面(Steam Win/Mac)不编译(USE_VIDEO off)——故仅 isCompletionVideoSupported
   * 为真时用。事件从 node 发出(this.node.emit), 组件本身无 on/off。
   */
  export class VideoPlayer extends Component {
    static ResourceType: { LOCAL: number; REMOTE: number };
    static EventType: {
      READY_TO_PLAY: string;
      PLAYING: string;
      PAUSED: string;
      STOPPED: string;
      COMPLETED: string;
      META_LOADED: string;
      CLICKED: string;
      ERROR: string;
    };
    resourceType: number;
    clip: VideoClip | null;
    /** false=objectFit=fill 铺满节点当前 contentSize; true 会在 metadata 加载时把节点尺寸改写成视频原始宽高。 */
    keepAspectRatio: boolean;
    play(): void;
    stop(): void;
    pause(): void;
  }
}
