# M01 设计达成收口 实现计划(2026-06-08)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans(inline,本会话执行)。Steps 用 checkbox 跟踪。
> 用户授权:全自主完成,每里程碑【自审(code-reviewer subagent 或细读 diff)+ codex 审(零框架)】,全绿后 commit,最后统一汇报。中途不问。

**Goal:** 把 M01 对照 spec §5.2 审计出的全部缺口收掉:spec 回写、兔子忽大忽小根除(引擎缩放,不重抽)、绳子动态真实化(对标割绳子的 Verlet 链)、"伸手够不着"教学 beat(即梦新动作)、v4 手持手电接线(既有计划 Task 8-10)、修复动画 v1。

**Architecture:** 纯逻辑模块 + 测试先行(项目既有模式);cc 胶水薄层;所有 gameplay 数值走 config/常量旋钮。Cocos MCP 当前断线 → 本轮无法 refresh,最终需用户 Stop→Play。

**Tech Stack:** Cocos Creator 3.8 TS strict / vitest / 即梦 dreamina CLI(skill jimeng-video-to-sprite-frames)/ codex CLI 审阅。

**Ground facts(2026-06-08 已核)**
- HEAD `1899118` typecheck ✅ + 337 测试 ✅(BASKET_AIR_DAMPING 已在;2D 钟摆已完整)。
- 核心谜题(显色/拼接/底光验证/胜利判定)早已接入 bootstrap;`M01FlashlightObservation`/`M01PuzzleInputRouter`(v4 Task6/7 纯逻辑)**未接**(bootstrap 0 引用);旧手电双路径 42 处引用待删(v4 Task8)。
- 帧实测:idle 去耳身高 404;耳后贴族 idleback/walkback ≈302(=75%)、earsback 首帧≈idle 末帧≈302(**动作内渐缩**)、earsup 反向(首≈303 末≈429);headbutt-000 总高 294(略蹲)。脚底线全族恒 490/512。
- 即梦入口 `.claude/skills/jimeng-video-to-sprite-frames/scripts/gen-video.sh`(frames2video 首尾双锁);白底首帧 `assets/art/characters/lemmy/source-videos/lemmy-firstframe-pencil-white.png`(描边已烘,**跳过** pencil-outline 脚本)。
- v4 Task 8-10 细节清单在 `docs/plans/2026-06-03-m01-intro-frame-anim-plan.md`(行号已漂,按符号名)。

---

## Task A: 即梦"伸手够不着"动作 —— 先发起生成(异步,~分钟级)

**Files:** `temp/reachmiss/`(中间产物)、`assets/art/characters/lemmy/source-videos/lemmy-reachmiss-source.mp4`(归档)

- [x] A1 后台发起:`bash .claude/skills/jimeng-video-to-sprite-frames/scripts/gen-video.sh <白底首帧> temp/reachmiss/source.mp4 frames2video`,PROMPT 动作段只写:"抬头看向上方,踮起脚尖,单臂向上伸到最高,努力去够头顶上方够不到的东西,够不到,放下手臂,耳朵微微耷拉一下显出失望,回到原站姿"(其余防漂移句保持模板)。首=尾=同一张站姿 → 回到原点,适合一次性动作。
- [x] A2 生成期间执行 Task B/C/D;视频落地后进 Task E。
- [ ] 失败兜底:若即梦不可用/质量不可用 → 复用现有 reach 帧 + 去掉触碰(篮子不动)作 v1,汇报里明示。

## Task B: spec §5.2 回写(source of truth 先行;CLAUDE.md 铁律)

**Files:** Modify `docs/design/game-design-spec.md` §5.2(597/601/603 段、613 流程①)

- [x] B1 改写开场叙事为已实现+本轮设计:走入→roaming 点哪走哪→**点篮(不在篮下)= 走近伸手够、够不着、篮子纹丝不动(教学 beat)**→点地走到篮正下方(走近时收耳·耳后贴走入)→点篮=原地起跳顶篮(上升段初触篮底受力)→**篮子被顶起、被两根不可拉伸软绳拽住乱晃**→每顶出一批(3 片)、3 次全出→手电掉出砸头(startle)→仍可点哪走哪→点地上手电→蹲下拾起。
- [x] B2 视觉要素同步:两股软绳接篮**两耳打结处**;手电尺寸=莱米身高约 1/5;删"够向吊篮→篮子摇晃倾倒"旧叙述。核心谜题段(观察/拼接/验证/显色规则/胜利条件)**不动**。
- [x] B3 typecheck/测试不涉及;git commit `docs(spec): §5.2 回写 M01 开场为顶篮+够不着教学+软绳物理现实`。
- [x] B4 审阅(codex 抓到 L602 残留+ramp 中段瘪 14%, 均已修):自读 diff 对照本计划;codex 零框架审 spec diff(给对象不给结论)。

## Task C: 兔子"不忽大忽小"——逐动作渲染缩放(不重抽)

**Files:** Modify `assets/scripts/cocos/LemmyActorContract.ts`(LemmyFrameActionSpec + 5 套数值)、`assets/scripts/cocos/LemmyActor.ts`(fitSpriteToFrame 每帧缩放+脚底锚定)、Test `tests/cocos/LemmyActor.test.ts`(衔接缝连续性断言)、Create `scripts/lemmy-measure-framesets.py`(地面真值量具)

**设计(关键:earsback 是"动作内渐缩",常数缩放会在 idle→earsback 接缝跳变):**
- contract 加 `renderScale?: number | { from: number; to: number }`(ramp 按帧序线性插值)。
- 数值(以 idle 去耳身高 404 为基准):`earsback {from:1.0,to:1.34}`、`idleback 1.34`、`walkback 1.34`、`earsup {from:1.34,to:1.0}`、`headbutt ≈404/285≈1.42(以 headbutt-000 站姿身体推算,执行时实测定值)`。其余动作不写=1.0。
- LemmyActor:`showFrame` 时按当前帧算 scale → `setContentSize(displaySize×s)` + **脚底锚定**:`spriteNode.y = (FOOT_FRAC−0.5)·displayH·(s−1)`,`FOOT_FRAC=490/512`(全族实测脚底行)。镜像 flip 只动 x,不冲突。
- [x] C1 写量具脚本(从早先 python 逻辑固化),输出各套站姿身体高/脚底行 → 锁定 headbutt 精确值。
- [x] C2 失败测试:衔接缝连续性(earsback.to==idleback==walkback;earsup.from==idleback;earsup.to==1;headbutt×其站姿身体≈404±5%)+ ramp 插值函数单测。
- [x] C3 实现 contract + actor;typecheck+全测绿。
- [x] C4 审阅(codex High: 线性ramp→逐帧曲线+平滑锚点拟合, 15cf342)(自审 diff + codex);commit `fix(lemmy): 折耳族逐动作渲染缩放+脚底锚定, 治收耳后变小(不重抽)`。

## Task D: 绳子动态真实化(研究→统一重做)

**Files:** Create `assets/scripts/cocos/M01RopePhysics.ts`(纯)、Test `tests/cocos/M01RopePhysics.test.ts`、Modify `assets/scripts/cocos/M01IntroSequence.ts`(删 basketSusp* 2D 钟摆+视觉链双系统 → 单链)、Modify `tests/cocosProjectScaffold.test.ts`(它断言 intro 源码含 BASKET_KICK_STRENGTH/spawnBasketRope 及钟摆时代注释语境——保符号名不改名, 语境断言随实现更新)。旋钮去向:**保留** BASKET_KICK_STRENGTH(竖直踢)+ 新增 BASKET_KICK_LATERAL_PER_PX(侧向=莱米偏心物理来源);**删** BASKET_GRAVITY / BASKET_AIR_DAMPING / basketSusp*(被链模型吸收;H1 死符号 grep 全列入)

- [x] D1 研究(Jakobsen GDC2001/Verlet链+逆质量加权重尾, 见提交说明):WebSearch「Cut the Rope rope physics verlet」「2d rope verlet distance constraint heavy tail mass」等,拿到业界做法(预期:Verlet 链+质量加权约束,**重物=链末端粒子**,而非两套系统)。要点记进本文件附录。
- [x] D2 失败测试(纯):静置收敛到绳长悬垂;kickTail 后回落、x 振荡衰减(被绳拽着乱晃→渐停);头端钉死;长仿真无 NaN;质量加权(篮重→绳点让位)。
- [x] D3 实现 `createRope/stepRope/kickTail`(子步进 dt 固定、迭代约束、tail 质量比旋钮);M01IntroSequence 改为:链 tail=篮子(2D 自由,**不锁 x**),headbutt 冲量方向=竖直为主+按莱米相对篮心横向偏移给侧向分量(物理来源);篮子节点跟随 tail;两股渲染保留。删 basketSusp*/BASKET_GRAVITY/AIR_DAMPING 旧路径。
- [x] D4 typecheck+审阅(codex 2×Medium: 仅拉伸侧约束+子步余数累加器, f0797e7)+全测绿;自审 + codex 审;commit `feat(m01): 割绳子式统一 Verlet 重尾链, 篮子被顶起后被软绳拽住乱晃`。

## Task E: "伸手够不着"接线(等 Task A 视频)

**Files:** 抽帧→`assets/resources/art/characters/lemmy/reachmiss/`(512²+meta);Modify contract(加 `reachmiss`)、`M01IntroSequence.ts`(beginBasketReachNudge→beginBasketReachMiss:走近→reachmiss→idle,**篮子零运动**,删 gentleNudgeBasket+WOBBLE 常量+reach_contact 消费)、tests(scaffold/IntroFlow 相应断言)

- [x] E1 抽帧:弧线动作 → `extract-frames-arc.py`/bodynorm【站姿首帧躯干基准·统一缩放】对齐 idle 躯干 131、脚底锚定(skill「保持大小一致·进阶」);**跳过描边脚本**(pencil 已烘);512² 压缩;meta 按既有 5 套已验证模式手建——**每文件 uuidgen 全新 uuid(严禁复制模板 uuid:重复 uuid 腐蚀 asset DB)**、512²+trimType none;编辑器下次启动 reimport 接管(2026-06-03 计划「不手写假 meta」在此按 5 套先例有意反转,已知代价=用户 Play 前不可见)。同步把 reachmiss 加进 `tests/cocos/LemmyFrameAssets.test.ts` 固定动作清单(否则 meta/orphan 守卫静默跳过新目录)。
- [x] E2 量化验收(站姿躯干102-103%/脚底490/totH430; 失望耷耳beat成立):站姿首/末帧躯干≈131±3、脚底行≈490、与 idle 等高并排目检 contact-sheet。
- [x] E3 接线+删旧 nudge;contract `reachmiss {fps≈18, loop:false, holdLast:true}` 无 events;reach 动作与其 contract 事件保留(他处暂无消费,合同稳定)。
- [x] E4 typecheck(5a1318c)+全测绿;自审+codex;commit `feat(m01): 伸手够不着教学 beat(即梦 reachmiss 帧), 篮子不动`。

## Task F: v4 手持手电接线(执行既有计划 Task 8→9→10)

**Files:** 按 2026-06-03 计划:`M01GreyboxSession/Layout/Drag/Art/Bootstrap` + 相应测试;intro 衔接:`M01GreyboxBootstrap.init` 传 `onFlashlightAcquired` → 置 `flashlightAcquired` + 起 beam。

- [ ] F1 Task8 删两套旧路径+【新增】Session.clearFlashlight(灭态;今日 Session 尚无此法。按符号名清单,TDD:先写 clearFlashlight 失败测试);同步全部受影响测试;typecheck+全测绿;commit。
- [ ] F2 Task9 新接线:beam/覆盖面锚莱米(Task6 fragmentsInCoverage)、routeTap(Task7)分派 点手电循环/点地 walkTo/点拼片拾取+灭灯、`physicsSettled && flashlightAcquired` 双门控(只门控拼接侧);覆盖面半径等数值若 config 缺 → 按 puzzle-configs 规则补 config+comment;typecheck+全测绿;commit。
- [ ] F3 Task10 逐拍核验 spec §5.2(B 回写后版本)+ 旧路径不可达断言;自审(code-reviewer subagent,本里程碑最大)+codex;commit。

## Task G: 修复动画 v1(齿轮转+碎片漩涡+星光)

**Files:** Create `assets/scripts/cocos/M01RepairSequence.ts`(纯时序编排, 仿 M01IntroFlow/M01RopePhysics 模式——Bootstrap 3629 行含 cc 不可直接 vitest)、Test `tests/cocos/M01RepairSequence.test.ts`、Modify `M01GreyboxBootstrap.ts`(completed→驱动时序)。**方向按 spec §5.2 修复动画原文:齿轮转动 → 碎片以漩涡状【喷出】→ 化为持续星光(不是收束!)**;镜头拉远无相机系统 → 省略并在汇报明示(电影化留后续美术轮, spec 不动)。数值入 config `repair`(执行时读结构,缺则补+comment)。

- [x] G1 读 config.repair 现结构;M01RepairSequence.ts 时序纯函数(齿轮转/喷出/星光各 phase 的 t→指令)+失败测试 → 实现 → 绿。
- [ ] G2 bootstrap 接 completed → 播放;不做镜头拉远(无相机系统,YAGNI;spec 全量电影化留后续美术轮,汇报明示)。
- [ ] G3 自审+codex;commit `feat(m01): 修复动画 v1(齿轮转动+碎片漩涡收束+星光脉冲)`。

## Task H: 收尾

- [ ] H1 全量 typecheck+test;grep 死符号(旧手电/旧 nudge/basketSusp 残留)。
- [ ] H2 active.md 重写当前态(Z 节收口+新增各节);冒烟说明(Cocos MCP 断线,需用户 Stop→Play 清单)。
- [ ] H3 claudeception 评估;最终汇报(达成表+遗留+Stop→Play 验收清单)。

## 风险
- 即梦质量/配额 → Task A 兜底。
- Task F 是最大爆破面(42 引用+多测试) → 严格按符号清单+每步全测;三次不同尝试失败即停(CLAUDE.md)。
- earsback ramp 若与源内渐缩节奏不同步,缝处仍可能轻微呼吸 → 旋钮+汇报待 live。
- 修复动画观感属美术 taste → v1 仅"可信",不冒充终稿。
