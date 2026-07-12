# M01 通关过场 — Steam 桌面 FFmpeg 视频解码器（立项方案）

状态：**方案 B（自建 FFmpeg 解码器）已选定，分阶段执行计划 + 环境清单见文末**。用户 2026-07-11 拍板走 B（理由：全游戏多段过场把插件 + JSB 的一次性投入摊薄，B 唯一强过帧序列窗口化的"内存与分辨率解耦"正好命中 HD 需求）。当前 Steam 桌面仍走逐帧 Sprite 序列（内存重，见下），作为 native 落地前的**过渡/降级路径**保留。

> 决策留痕：曾权衡过更懒的替代——**窗口化加载帧序列**（把 `resources.loadDir` 一次性全载改成滑动窗口预载 N 帧、播完即释放），纯 TS、当天可验、960×640 下 21 帧窗口即 <50MB。它被否是因为 **HD 1920×1280 下一帧 RGBA≈9.4MB，<50MB 只剩 ~5 帧窗口、缓冲薄易卡**，而 FFmpeg 流式解码缓冲恒 1~2 帧、与分辨率无关。要 HD + 多段过场 → B 才是长期正解。另评估过 Bink（业界黄金标准但 ~$8500/平台/作品，为 15s 过场买断离谱）、OS 原生 MediaFoundation/AVFoundation（要写两套平台后端，比一套 FFmpeg 跨平台更费）、libVLC（太重）、Theora（要转码 + 质量差）——均劣于"移植 FFmpeg 基座"。

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

---

## 执行计划（分阶段）

每阶段标注**依赖**与**此环境能否验证**（本仓无桌面原生工程 + 无 FFmpeg 库 + 本机为 Mac 无 Windows MSVC，故原生阶段须在有构建机的会话做）。

| # | 阶段 | 产出 | 依赖 | 此环境可验 |
|---|---|---|---|---|
| 0 | **环境搭建** | 导出 Cocos 桌面原生工程；备齐 FFmpeg 桌面库（Win/Mac，LGPL 动态库）；Win 构建机/CI | — | ❌ 卡在操作者，见「环境准备清单」 |
| 1 | **TS 契约 + 降级接线** | `M01VideoDecoderPlayer.ts`（接口对齐 `M01CutscenePlayer`）；JS 侧解码器接口声明 + 原生模块存在性探测；`M01GreyboxBootstrap` 桌面分流「有 native decoder → 用它，否则回退帧序列」；`M01VideoDecoderTiming` 纯计时可单测 | — | ✅ typecheck + vitest |
| 2 | **原生 C++ 解码器** | 移植 [Xrysnow](https://github.com/Xrysnow/cocos2d-x-video) 的 `FFDemuxer/FFCodec/FFFrameQueue`，砍移动端只留桌面；`M01VideoDecoder`：`open(path)` / `decodeNextFrame()→{rgba,w,h,ptsMs,done}` / `close()`（swscale YUV→RGBA8888） | 阶段0 | ❌ 需原生工程编译 |
| 3 | **JSB 绑定** | 手写 sebind 或 `.ini` 自动绑定，注册 `M01VideoDecoder` 到 JS；桌面 `#if CC_PLATFORM==(WINDOWS\|MACOS)` 门控，非桌面不编 | 阶段0-2 | ❌ 需原生工程编译 |
| 4 | **贴图上传 + 接线** | `M01VideoDecoderPlayer.update(dt)` 按 PTS 拉帧 → `Texture2D`（`reset`+`uploadData`）→ `SpriteFrame`（**`packable=false`**，见坑）→ sprite；音轨走独立 `AudioSource`（v1 复用现成 mp3，见下）；bootstrap 分流真正接上 DecoderPlayer；资产改指母版 mp4 | 阶段0-3 | ❌ 需原生工程编译 |
| 5 | **编译 + 验收** | Win/Mac 原生包通关 M01：<50MB、1920×1280、音画/跳过/播完出卡与 iOS 一致；跑 codex 对抗审（原生改动 headless 验不了，必审） | 阶段0-4 | ❌ 需构建机 |
| 6 | **收尾** | 删 `completion-frames/`（344 帧）省包体；把 DecoderPlayer 抽成通用视频组件，给 M02-M10 过场复用 | 阶段5 | 部分 |

**关键：阶段 1 不是沉没成本。** 叠层/背板/看门狗/跳过/`onCompletionVideoDone`/音轨这套在 `M01GreyboxBootstrap` 里已上线、已过审——阶段 1 只新增「桌面解码器分支 + 降级」，阶段 2-4 的原生活儿只替换「帧加载 + 渲染」内循环、插回同一叠层。做了阶段 1，原生模块要暴露的契约就钉死了，且 Steam 在 native 落地前继续用帧序列跑着。

## 环境准备清单（阶段 0）

> 这是本项目当前**唯一的硬阻塞**：没有它，阶段 2-5 一行原生代码都编不了、验不了。

**A. Cocos 桌面原生工程**
- Cocos Editor → 构建发布 → 平台 `Windows` / `macOS`，各出一次，生成 `native/engine/` + `build/<platform>/`（CMake 工程）。
- 先空跑一个不带解码器的原生包，确认基线能通关 M01（走帧序列）再动手。

**B. FFmpeg 桌面库（只解码，LGPL 动态库）**
- 需要：`libavformat` `libavcodec` `libavutil` `libswscale` `libswresample`（音频解 PCM 才需 swresample，v1 若走独立 mp3 可不用）。
- **商用合规起见倾向自编 LGPL shared**（我们只解码，不需要任何 GPL 组件；H.264 + AAC 解码器是 FFmpeg 内建，`--disable-gpl` 也在）：
  ```
  ./configure --enable-shared --disable-static --disable-gpl --disable-nonfree \
              --disable-programs --disable-doc
  ```
  - Windows：MSVC 工具链下编，或用确认为 LGPL 的预编译分发（gyan.dev / BtbN 的默认 build 多带 GPL，别直接用）。
  - macOS：arm64 + x86_64 各编一份，`lipo -create` 合成 universal；brew 的 ffmpeg 默认带 GPL 组件，商用别直接分发。
- 放进原生工程第三方目录，如 `native/third_party/ffmpeg/{win,mac}/{include,lib}`。

**C. 构建链**
- macOS：Xcode Command Line Tools（clang，本机已有）+ CMake。
- Windows：Visual Studio 2019/2022（MSVC v142/143）+ Windows SDK + CMake，**或** GitHub Actions windows runner 做 CI 构建（本机 Mac 出不了 Win 原生包）。

**D. LGPL 合规**
- **动态链接**（不静态链）→ 满足 LGPL 可重链接要求。
- 随包附 FFmpeg `LICENSE` + 版权声明 + 所用 libav* 版本号 + 提供获取源码/重链接途径。
- 确认库构建时含 `--disable-gpl --disable-nonfree`。

**E. 母版资产（已就位，仅需确认编码）**
- 母版：`assets/art/stage1-m01/completion-video/cutscene-v2-sources/m01-completion-cutscene-master.mp4`（1920×1280）。
- 解码输入：`assets/resources/art/stage1-m01/m01-completion-cutscene.mp4`（iOS VideoPlayer 现也用它）。
- 确认是 **H.264 视频 + AAC 音频**（FFmpeg 内建解码器直解）；若封装异常先 `ffmpeg -c copy` remux 一遍。

## 技术要点 & 已知坑

- **音频 v1 简化（ponytail）**：先**不**在 C++ 里解 PCM。复用现成 `completion-audio.mp3` 作独立 `AudioClip`，与解码首帧同起——这正是当前帧序列路径已在用、已验证的做法，避开 C++ 音频同步 + swresample + `AudioPCMDataView` 整块表面。~15s 定长过场，两者同起后各自跑即帧级够同步。FFmpeg 解 PCM 留作 v2 可选优化（能省掉那个 mp3 资产）。**这样阶段 2 的原生契约收窄为纯视频**：`open/decodeNextFrame/close`，不含 `getAudioPCM`。
- **运行时数据纹理 → 动态图集洪水（务必 `packable=false`）**：代码生成的原始 `_data` 纹理是非法 `TexImageSource`，被 Cocos DynamicAtlas 打包时每帧洪水报 `texSubImage2D "Overload resolution failed"`。解码帧 SpriteFrame **必须 `frame.packable=false`**。（本仓踩过，见记忆 `project_cocos_runtime_data_texture_dynamic_atlas_flood`。）
- **解码线程模型**：`update(dt)` 里同步解一帧 HD 可能掉帧。Xrysnow 的 `FFFrameQueue` 本就是给「解码线程预填 + 主线程取就绪帧」用的——移植时保留它，主线程只 `uploadData`，别在 update 里 demux+decode+swscale。
- **swscale 目标格式** `AV_PIX_FMT_RGBA`，与 `Texture2D` `RGBA8888` 对齐；注意 stride/对齐，逐行拷别整块拷（宽非 4 对齐会错位）。
- **接口契约（TS ↔ native，阶段 1 先在 TS 侧定死）**：
  ```ts
  interface IM01VideoDecoder {
    open(path: string): boolean;
    decodeNextFrame(): { data: Uint8Array; width: number; height: number; ptsMs: number; done: boolean } | null;
    close(): void;
  }
  ```
  TS 侧 `sys.isNative && (Windows|macOS)` 时探测 `globalThis.jsb?.M01VideoDecoder` 是否注册，未注册 → 回退帧序列（阶段 2-4 未编译期间即走此降级，保证 Steam 一直能跑）。
- **验收必跑 codex**：原生 + 玩法路径 headless 验不了（本仓反复的教训），阶段 5 必须在编辑器/真机 + codex 对抗审双验。
