---
globs: StarGuardian/Assets/Scripts/M0*/**/*.cs, StarGuardian/Assets/Scripts/Core/**/*.cs, assets/scripts/levels/**/*.ts
---

# Puzzle Script Rules

> **适用边界(2026-07-16 划定)**: 本规则管**玩法逻辑层** —— Unity `Scripts/{Core,M0x}/`(不含
> `M0x/Rendering/`)与历史 Cocos `scripts/levels/`。**不管渲染层**: `Scripts/M0x/Rendering/`(渲染
> 契约)与 `GlowProbe/`(Unity 探针/MonoBehaviour harness)。
>
> 理由: 渲染契约是 Cocos **View 层常量的逐值忠实映射**(如 `WandTapRadiusPx=70` ← `M02PrologueView.ts:24`),
> Cocos 侧这些值本来就**不在 config 里**(config 零命中), 硬塞进 JSON 会①凭空发明 Cocos 没有的键、
> ②撞上"双源 config 字节相等"的同步测试。等 Cocos 树退役后可统一决定是否把 view 常量下沉进 config。
> 探针同理: 它是临时验证 harness, 不是 puzzle script(300 行上限针对后者)。
>
> ⚠️ 此边界由一次真实误判划出: glob 曾被扩到 `Scripts/**` + `GlowProbe/**`, 导致零框架 codex 审
> 按规则报出"玩法阈值硬编码""探针超 300 行"等违规 —— 报告没错, 错的是 glob 圈错了层。


- ALL gameplay values (timing, scores, thresholds, counts) MUST come from JSON configs (Unity 运行时源 `StarGuardian/Assets/Resources/Configs/`; 历史 Cocos `assets/resources/configs/`) — never hardcode
- Use `dt` (delta time) for all time-dependent logic — frame-rate independence is mandatory
- Each puzzle must implement the `IPuzzle` interface (init, update, checkWin, reset)
- State transitions use explicit state machine pattern (IDLE → ACTIVE → COMPLETED / FAILED)
- No direct UI manipulation — emit events, let UI layer subscribe
- Each puzzle script file should stay under 300 lines; extract helpers if needed
