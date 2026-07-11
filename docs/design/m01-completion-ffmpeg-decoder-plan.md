# M01 通关过场 — Steam 桌面 FFmpeg 视频解码器（立项方案）

状态：**未实现，立项待排期**。当前 Steam 桌面走的是逐帧 Sprite 序列（内存重，见下）；本方案是取代它的正解。

## 为什么要做

- Cocos Creator 3.8 的 `VideoPlayer` 组件**桌面原生构建不编译**（`native/CMakeLists.txt`：非 Android/iOS/OHOS/OpenHarmony 平台 `set(USE_VIDEO OFF)`，引擎也只有 `-ios.mm`/`-java.cpp` 后端，无 win/mac）。官方文档 + 论坛确认桌面不支持。
- 当前兜底方案：整段抽帧成 `completion-frames/`（344 帧 960×640 JPG），运行时 `resources.loadDir` 全加载、逐帧换 `Sprite.spriteFrame`。**代价**：解码后 RGBA 贴图内存 = 344 × 960 × 640 × 4 ≈ **845MB 峰值**（用完即 `assetManager.releaseAsset` 释放，但峰值仍高），且分辨率受内存限、上不了 HD。
- 业界桌面过场普遍用**压缩视频流式解码**（Bink / WebM-VP9 / Theora），内存极省、可上 1080p+。这才是正解。
- 目标：Steam 桌面流式播 **iOS 同一个母版 mp4**（`m01-completion-cutscene.mp4`，1920×1280），内存省、HD、两端统一。

## 方案：自建 FFmpeg 原生解码器 + JSB

参考：Cocos 官方《Building An Internal Video Player Based On FFmpeg》、开源 [Xrysnow/cocos2d-x-video](https://github.com/Xrysnow/cocos2d-x-video)（cocos2d-x FFmpeg 视频支持，可移植思路）。**优先移植/改造现成实现，别从零写。**

### 运行时数据流

```
mp4 ──libavformat(demux)──► 视频包 ──libavcodec(decode)──► YUV 帧
                                                              │ libswscale (YUV→RGB24/RGBA)
                                                              ▼
                                        每帧上传到 cc.Texture2D (updateWithData) ──► Sprite 显示
       音频包 ──libavcodec──► PCM ──► cc.AudioPCMDataView / 或独立 AudioClip 同步
```

- 关键：**流式**，任意时刻只驻留 1~2 帧解码缓冲（几 MB），不是 844MB。
- 帧率同步：按 `dt` 累计的呈现时间戳（PTS）取帧，帧率无关（同 `M01CutsceneTiming`）。
- 音频：优先 FFmpeg 解出 PCM 走引擎音频；退而求其次用现成 `completion-audio.mp3` 作独立 `AudioClip` 与视频首帧同起（帧率一致即同步）。

### 实现步骤

1. **集成 FFmpeg 库**：Win（MSVC）+ Mac（clang/arm64+x64）预编译 libavcodec/libavformat/libavutil/libswresample/libswscale（或用 vcpkg/brew 版）。放进 `native/` 第三方目录，`CMakeLists.txt` 按平台 link，构建后把动态库随包发（Steam depot）。
2. **原生 C++ 解码器类** `M01VideoDecoder`（`native/cocos/.../`）：`open(path)` / `decodeNextFrame() -> RGBA buffer + pts` / `getAudioPCM()` / `close()`。参考 Xrysnow 实现，去掉移动端特判、只保桌面。
3. **JSB 绑定**：把 `M01VideoDecoder` 注册到 JS（`jsb_register_*` + `.ini` 自动绑定或手写 sebind），使 TS 能 new/调用。桌面 `#if CC_USE_...` 门控，非桌面平台不编。
4. **TS 组件** `M01VideoDecoderPlayer`（`assets/scripts/cocos/`）：仅在 `sys.isNative && 桌面` 时用；`configure(mp4Path, sprite, onComplete)`；`update(dt)` 拉解码帧 → 建/更新 `Texture2D` → `sprite.spriteFrame`；驱动独立 `AudioSource`；播完回调。接口对齐现有 `M01CutscenePlayer`（可互换）。
5. **接线**：`M01GreyboxBootstrap` 的平台分流从"支持 VideoPlayer? → 帧序列"改为"支持 VideoPlayer? → 桌面用 DecoderPlayer → （都不行）帧序列兜底"。资产用母版 mp4，弃 `completion-frames/`（或留作降级）。
6. **构建/测试**：只能在**导出的桌面原生工程**里编译+跑（本仓当前无原生工程导出、无 FFmpeg 库，故本环境无法编译/验证）。需在有 Cocos 桌面构建链的机器上做。

### 依赖与风险

- **必须的环境**：Cocos 桌面原生工程导出 + FFmpeg 桌面库 + MSVC/clang 构建链 —— 本仓/本会话没有，须单独搭。
- **授权**：FFmpeg LGPL（动态链接可商用，注意合规声明）；避开 GPL 组件（如 x264 编码，我们只解码不用）。
- **工作量**：原生插件 + JSB + 构建集成 + 跨平台测试，属**多日/多会话立项**，不是一次能完成。
- **过渡期**：FFmpeg 解码器落地前，Steam 继续用帧序列（能跑、内存重）。落地后删帧序列资产省包体。

### 验收

- Steam Win/Mac 原生包通关 M01：流式播 1920×1280 母版，内存峰值 < ~50MB（对比帧序列 845MB），画面/音画/跳过/播完出卡与 iOS 一致。
