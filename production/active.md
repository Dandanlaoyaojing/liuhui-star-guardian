# Active Work State

Last updated: 2026-06-05

> 这是**当前状态薄层**(CLAUDE.md 要求)。已完成的历史流水归档在 `production/archive/`,细节查那里或 `git log`。

## 当前活跃线:莱米角色动画

**M02 迷失的导航罗盘设计校正(2026-06-05)**:按用户指出的物理逻辑漏洞,已更新 `docs/design/game-design-spec.md` §5.3。M02 不再是“太阳 / 月亮 / 云同理自动对齐”的圆环匹配;第一步改为用日晷针影子反推出**地日二维方位线**(影子反方向,仅为观测台平面投影,不声称完整三维地日位置);第二步改为用**地日线 + 月相 + 亮面/盈亏/观测时段消歧线索**反推出地月方位,避免“半月/弯月可落在两侧”的非唯一解。胜利条件同步收口为 sun / moon / outer 三环校准。

**主角原型(canonical) 已定稿** —— 带手、干净无噪点、2000×2000 透明:
- `assets/art/style-references/lemmy-rabbit-canonical.png`(identity 母版,2000²)
- `assets/resources/art/characters/lemmy/lemmy-canonical.png`(runtime)
- `docs/design/style-references/2026-05-28-lemmy-rabbit-canonical.png`(dated 记录)
- 所有旧形象(4-24 低清/无手版/带噪点版/Luma 兔变体)已删,引用全部改向 canonical。
- **视图集**:canonical 是**斜侧(3/4)**视角(用于 idle 等);另存了**正侧(纯90°侧)**参考图 `assets/art/style-references/lemmy-rabbit-side-profile.png`(+ dated `docs/design/style-references/2026-06-02-lemmy-rabbit-side-profile.png`),从蹲下源视频 t3.0 帧抠透明+校色而来,作为莱米的正侧视图。(2026-06-02 误存的 `lemmy-rabbit-side-profile-v1.png`(实为斜侧)已按用户要求删除。)

**动画管线 = 即梦图生视频→抽帧**(完整方法见 skill `jimeng-video-to-sprite-frames`):
- 五套动作帧已产出并压缩(512→384/按显示尺寸缩 + pngquant/oxipng):
  - idle 12 帧 `assets/resources/art/characters/lemmy/idle/`(frames2video 首尾锁,等高归一化)
  - walk 36 帧 `.../walk/`(纯侧面朝左小碎步,等高归一化;朝右用 scaleX=-1 翻转)
  - reach 18 帧 `.../reach/`(够篮,统一缩放保留蹲→伸高度弧线)
  - startle 23 帧 `.../startle/`(受惊:中性→猛地低头→抬头吃惊瞪眼→恢复;弧线版抽帧 `extract-frames-arc.py`)。⚠️**源视频里有即梦自画的小果子,运行帧靠重组剔除**(`[f0,f0]+f9..f29`,丢掉带果子的 f1–f8)——重抽必须按 `source-videos/README` 的去果子步骤,否则果子会回来。吃惊眼是即梦"大白眼+黑点"(prompt 改不动,合成褐眼珠被否,用户接受白眼)。
  - crouch 24 帧 `.../crouch/`(蹲下:站定→下蹲→蹲住,准备拾取;斜侧;`extract-frames-arc.py … 0.5 1.0` 取后半段,源视频前半段弱走路弃用)。原始目标"走近→蹲下":走近用 walk + 引擎横移,到位接 crouch。
- ⚠️ **正侧走路(试过,放弃)**:2026-06-02 试用即梦生成纯正侧走路,即梦逐帧把身子画胖画瘦~10%(固有抖动,等比/身高/统一缩放都修不掉,非等比硬拉会变形),走路要求大小恒定→暴露成忽大忽小。**走路回退到第一版斜侧 walk**;设计回到 idle 斜侧 + walk 斜侧。结论:必须恒定大小的循环走路别用即梦帧,走引擎变换。(skill 注意/坑已记;`extract-frames-bodynorm.py` 是按不含耳身高归一化的尝试,能稳身高但修不掉体积抖动。)
- 源视频归档 `assets/art/characters/lemmy/source-videos/`(进 git,可重抽更多帧)
- 关键经验进 memory: 即梦防漂移(frames2video 双锁/prompt 只写动作/纯侧面防第二只眼)、pngquant 安全边界(高对比可用/低对比水彩会掏空→用 oxipng)、复杂动作可多抽帧。

**莱米手绘铅笔描边(定稿 2026-06-05, 会话 9c059bcc→4e145e89 接力)**:把定妆 canonical 的"浅铅笔灰外描边"统一同步到**全部 114 帧运行时精灵**(canonical + idle12/walk36/reach18/startle23/crouch24)。最终参数:**W5 描边宽**(基准内容高 820px, 每帧按自身内容高度等比缩 `W=round(5·Hc/820)` → 等高显示时粗细一致) + **0.45 颗粒**(`effect_noise σ78`, 每帧重生成、播放不冻结) + **浅铅笔灰** `clamp(58+L·0.55)` 随明暗深浅不一 + 描边只进 alpha 外缘环、身体水彩不动。定稿脚本 `scripts/lemmy-pencil-outline.py`(⚠️就地覆盖、只能跑干净帧, 重跑前先 `git checkout HEAD -- …/lemmy` 否则双重描边)。已 `oxipng -o4` 无损回压:该目录 8.64MB→5.31MB(−38%, 比 HEAD 原版还小)。验证:114/114 帧外缘环中性灰占比 0.85–0.95、等高并排描边一致(`temp/verify-post-oxipng-equalH.png`)。母版 `lemmy-rabbit-canonical.png` **不动**,描边只在 runtime 资产。**尚未 commit**(等用户确认)。
**走路决策(2026-06-05 定)**:用户明确**否决"单图引擎颠/squash 风格化走路"**(连否两次),坚持**用即梦 walk 36 帧**真迈步。→ walk 帧保留并已上描边,**不许删、不许退回单图方案**。

**全 5 套动画重抽(2026-06-05,已覆盖运行时帧 + 重建 .meta)**:从已归档源重抽、帧数加密、运行时 384²→**512²**。帧数 idle**24**/walk**48**/reach**36**/startle**29**/crouch**40**(旧 12/36/18/23/24,共 113→177)。每帧统一收尾:抽帧 → `scripts/lemmy-tone-match.py`(对比度拉到 canonical `V.std=0.160`,治"抽帧+缩放后发平",同口径帧只 0.143)→ `scripts/lemmy-pencil-outline.py` → oxipng。**walk 专属 `area-norm`**(按整体面积统一缩放锁尺寸,治"忽大忽小":即梦体积抖动~8-11%,走路恒定大小暴露成忽大忽小;bodynorm 只锁身高没用、宽度仍摆 26%,改锁面积→0.7%,均匀缩放不变形)。**walk 源=正面3/4 已归档源**(用户 2026-06-05 选定;纯侧面 crouch 源宽度摆更大 34%)。startle 去果子重组 `[#0,#0]+#13..#39`。`.meta` 重建为 512²+`trimType none`+新 UUID(帧序列尚未接 `LemmyActor`、无引用);⚠️ **Cocos 需 reimport 注册**(本会话无 cocos MCP)。详见 `source-videos/README` + 两个新脚本。

**帧序列接入 LemmyActor(2026-06-05,已做但⚠️未提交)**:全 5 套改帧播放。契约全帧化(`LemmyFrameActionId`=idle/walk/reach/startle/crouch;idle/walk 循环、reach/startle/crouch 一次性 hold-last;reach 在 **#34 伸顶**发 `reach_contact`;新增 `frameEventsBetween`)+ `LemmyActor` 帧播放器(`playIdle()` 循环、`walkTo()` **帧循环+引擎横移**弃单图变换、`playFrameAction(onEvent)`)+ `M01IntroSequence` 改调用(idle→`playIdle()` 不 await、reach→`playFrameAction("reach")`,**reach_contact→篮子倾倒命脉不变**)。**删了旧 transform/引擎走路路径**。自审(派独立 code-reviewer 交叉验证)修了 3+2 个问题:**粘性朝向**(治"走右到位后 idle 啪翻回朝左")、**打断停 walkTween**、**reach 事件运行时钳制+跨文件护栏测试**(防 reach 重抽变短软锁)、frame-0 事件注释、清 framePlaybackFrames。`typecheck` ✅ + **310 测试全绿** ✅。fps 在 `LEMMY_FRAME_ACTIONS`(idle12/walk16/reach18/startle18/crouch16)可调。

**⚠️ 为何未提交**:接线改动缠在 `M01IntroSequence.ts` 里(混着隔壁会话的 M01 intro 在途代码 ~95 行),要提交"接线"就得连那坨在途 intro 一起带进来 → 暂留工作区,等 intro 工作到位再一起提。已提交的只有帧资源 commit `8506b21`。

**下一步(本线)**:① Cocos **reimport** 注册新帧 + 引擎实看(精灵渲染/朝右翻转观感/walk 横移/reach 手感;本会话无 cocos MCP)。② **walk 方向待定**:代码是**朝右走**(`LEMMY_OFFSCREEN_X=-460`→`LEMMY_UNDER_BASKET_X=290`),与本档"从右走入"叙述相反;改方向是 M01 场景常量符号的事(属 intro 在途代码),不是 LemmyActor。③ 接 **startle/crouch 进 M01 intro**(手电砸头→startle→蹲下捡起,intro 待办;LemmyActor 侧 `playFrameAction("startle"/"crouch")` 已就绪)。④ 提交时机见上。
codex 的 `LemmyActorContract.ts` 取消契约(`LemmyActionInterrupted`/`LemmyActorDestroyed`/`createLemmyCancellationContext`)可复用;M01IntroSequence 已有接入 diff。

**M01 吊篮贴片 / 内胆(2026-06-03)**:吊篮方向改为**略深篮身 + 前壁遮挡 + 物理内胆**。hanging / tipped runtime 贴片已换成深篮空图,新增 `intro_basket_front_occluder` 前壁遮挡层;静置时只露上层 4-5 个拼片,其余被前篮壁遮住。代码侧 `M01IntroLayout` 定义 9 片 4-3-2 物理堆叠坐标、底板/左右斜壁内胆 collider、前壁遮挡高度;`M01IntroSequence` 在篮子节点下生成不可见内胆 collider,倾倒释放后保留 650ms 导流再销毁,避免地面阶段继续挡片。测试护栏已从"可见区域装下九片"改为"物理内胆装下九片,可视只露 4-5 片"。

## 发行平台(2026-06-01 定)
iOS App + Steam(PC/Mac)。放弃 Web/微信小游戏/安卓 → 微信 4MB 包体限制不再适用,动画帧数可按质量给足。CLAUDE.md / game-design-spec.md 已同步。

## 仓库整洁(2026-06-01)
- 删了无引用的 PSD(`m01-reference-psd-slices/` 55个 + `source/` 旧迭代版 7个,共~44MB)。
- 运行时图压缩 17MB→8.4MB(按 displaySize×2.5 等比缩 + oxipng 无损,meta/UUID 不变引用不断,画质 OK)。
- `.git` 历史重写(清历史里的大文件旧版)评估后**不做** —— 高风险(10分支+worktree+force-push)换低收益(省80MB,不影响项目本身),当前工作区清爽即达标。

## M01 现状
M01(秩序之基首关)美术/物理/手电/拼片已于 2026-05-26 收口。详细调试历史见 `production/archive/2026-05-m01-polish-log.md`。
权威玩法 spec: `docs/design/game-design-spec.md` §5.2。

**M01 剧情改版(2026-06-02,spec §5.2 已改)**:开场从"碎片从天上掉 + 直接给手电"改成**有动机的"捡到式"叙事**——莱米走近大螺母(齿轮=螺母同一机械星体;关名/ID/文件名不动)→观察→(玩家点吊篮)够吊篮→篮子摇晃→9 拼片掉出堆地→**一支三色手电筒也从篮里掉出、砸到莱米头上**→莱米**蹲下把手电筒捡起**→玩家用手电照拼片发现短暂显色、自然学会核心机制。核心谜题(照色推理+交叠拼接+颜色规则+底光验证)**不变**;开场关键步玩家点触发。
**实现待办**(`M01IntroSequence` 已有 走入→够篮→篮子摇晃→拼片 spill;需补):① 观察停顿;② 手电筒放进吊篮、随拼片一起 spill、掉落砸到莱米(startle);③ 莱米蹲下捡起(crouch);④ 手电筒改为"捡起后"才成为**手持**观察工具(旧预置固定 anchor `{360,110}` 作废);⑤ 照拼片发现。**依赖**:`LemmyActor` 目前 transform-based(只有 idle/walk/reach 三个变换 schedule),要播 startle/crouch 需先给它加动作(加 transform schedule,或上帧序列播放器——5 套帧表已就绪但尚未接线)。
**M01 手电交互最终定(v4,2026-06-03,spec §5.2 已据此改)**:**推翻 v3 的"固定三按钮工具 / 固定光束"**——手电是莱米**手持**的,固定光束讲不通。最终模型:莱米捡起手电后手持;**点手里的手电**循环 红→黄→蓝→灭(手电小,无需精准点按钮);**点地面空白**莱米走过去、手电**覆盖面(不止1片)随莱米移动**扫照;覆盖面内候选碎片按当前灯色显色,移出/灭即恢复灰白;**点某拼片 = 玩家拾取(拼片随指针、非莱米去捡)并使手电熄灭**;拼片由玩家拾放、莱米只负责持手电。代码:代码里**现有两套手电机制(固定光束路径 + 手持指针拖动路径)全删**(含旧 `heldFlashlightId` 约20处引用、`revealAllFragmentsWithActiveFlashlight` reveal-all);只保留底层显色/选色模型并**新增 `clearFlashlight()`(灭态)**;覆盖面光束**新建**、锚到莱米(新字段 `flashlightAcquired`/`lemmyFlashlightNode`/`activeLightState`,不复用旧名)。`physicsSettled && flashlightAcquired` **仅**门控正式拼接/拾放片/底光验证,**不**挡开场走位/点篮/点掉落手电。config 实路径 `assets/resources/configs/stage1/m01-memory-gear.json`(load `configs/stage1/m01-memory-gear`)。**plan 已重写为 v4 + 两轮评审(Claude plan-reviewer + Codex)+ 多轮修订(P1/P2、命中优先级分阶段、active 措辞)**,⚠️ **执行前做最后确认、尚未开工**:`docs/plans/2026-06-03-m01-intro-frame-anim-plan.md`。**Claude 本环境实测 cocos MCP 在线可用**(可自做 refresh/reimport/scene 查询)。但**预览服务器起停 MCP 与 HTTP(:3000) 都返回 "not supported"**(2026-06-03 双复验)——`.ts` 改动重编译须在编辑器**手动**重启预览(Project>Preview),**Codex 也做不到、无额外能力**;Codex 走 HTTP 只是做 refresh_assets。
**M01 灯泡组件候选(2026-06-05)**:按用户要求用 Ideogram V4 `/v1/ideogram-v4/generate` 生成,不是 remix;4 张风格参考图在 `docs/design/generated-stage1-intro-art/ideogram-style-refs/bulb-style-ref-*.jpg`,调用字段 `style_reference_images`。已出 4 个独立候选源图 `docs/design/generated-stage1-intro-art/m01-bulb-ideogram-generate-v4-style-refs-v3-option-{1..4}.png`,并本地抠出透明版 `...-transparent.png`;预览拼图 `m01-bulb-ideogram-generate-v4-style-refs-v3-transparent-contact-sheet.png`。当前观感:2/4 更像可用游戏组件,1 偏旧灯泡,3 偏大和真实。
