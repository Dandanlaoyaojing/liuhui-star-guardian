# Active Work State

Last updated: 2026-06-19

> 这是**当前状态薄层**(CLAUDE.md 要求)。已完成的历史流水归档在 `production/archive/`,细节查那里或 `git log`。

## 当前活跃线:M01 弱磁吸一致性修复(2026-06-19)

用户反馈: 拼片吸到平台按形状判断,但同形状有的能吸附有的不能。
根因: `resolveTargetPieceSlotDrop` 的锁定目标槽位先按 `expectedFragmentId` 过滤,导致同为 `shape:circle` 的 `fragment_circle_blue_1` 不能吸到圆形目标槽;圆形无旋转问题,这里是 ID 锁死而不是形状判定。
修复: 目标槽位吸附改为按形状 + 现有旋转容差判断,不再按具体碎片 ID 判断;完成判定仍由后续证据/solution 校验负责。未改玩法 spec。
验证: 先加红灯用例 `fragment_circle_blue_1` 放到 `target_piece_circle_yellow_1` 圆槽失败→修复; `npm test -- tests/cocos/M01GreyboxDrag.test.ts ... M01GreyboxLayout.test.ts` ✅(82 tests); `npm run typecheck` ✅; `npm test` ✅(33 files / 364 tests)。
下一步: Cocos Stop→Play 现场验三个圆片都能吸到圆形目标槽;三角/六边形仍需旋转角度正确才吸。

## 当前活跃线:M01 设计达成收口(2026-06-12 全部代码落地并提交;⚠️待用户 Stop→Play live 验收)

**本轮(2026-06-12, 接 6-08 session handoff)按计划 `docs/plans/2026-06-08-m01-design-completion-plan.md` 全自主跑完 B→H**, 每步 codex 零框架审($consumed)+ 测试门禁。**HEAD `9c82d5e`, typecheck ✅ + 358 测试全绿 ✅, 工作区干净**(未 push)。

**已落地(全部已 commit)**:
1. **spec §5.2 回写**(`3e9d606`+残留修): 开场=点哪走哪→(不在篮下点篮)走近伸手【够不着】教学 beat→走到篮下(靠近收耳)→顶篮(上升段初触受力)→篮子被软绳拽住乱晃→3 顶×3 片→手电掉砸头(尺寸=莱米 1/5)→仍可走位→点手电蹲拾。核心谜题段未动。
2. **兔子不忽大忽小**(`7187949`+`15cf342`): 契约 renderScale(number/ramp/**逐帧曲线**)+LemmyActor 脚底锚定; earsback/earsup 逐帧实测曲线(线性 ramp 中段瘪 14%, codex 抓的; 量具在耳翻越段有换挡伪影→锚点分段拟合), idleback/walkback 1.338, headbutt 1.423→1.502; 接缝显示身体高恒 404±1.5%(测试守卫)。**重抽否决**(用户: 适当放大和 idle 一致即可)。
3. **绳子真实化**(`edb45b0`+`f0797e7`): 研究对标割绳子(Jakobsen Verlet)→ `M01RopePhysics` 纯模块: **篮子=链尾重粒子**(invMass 0.05), 质量加权距离约束【仅拉伸侧】(codex: 双向会吃掉竖直顶击只抬 11px), 固定子步+余数累加器(codex: 取整丢余数 48fps 快 20%); 顶篮 kickTail(竖直 600+侧向=莱米偏心×3 封顶 220)→ 弹起被绳拽住乱晃渐收。8 测试含帧率无关性。两股吊带渲染 splay 到两耳(±99)。
4. **伸手够不着**(`5a1318c`): 即梦 reachmiss 40 帧(frames2video 双锁 pencil 首帧, arc 统一缩放, 站姿躯干 102-103% idle/脚底 490)——踮脚伸够两次落空→耳朵耷拉失望→回站; 篮子**零运动**(删 gentleNudge)。源视频已归档+README。meta 逐文件新 uuid。
5. **v4 手电 Task8-10**(`6ff0ce1`/`af31ff1`/`f10451c`): 删两套旧路径(-707 行/40+符号, scaffold 不可达守卫)+Session.clearFlashlight; intro 拾起→手电重挂莱米节点(handoff {lemmyNode, flashlightNode}); bootstrap 覆盖面锚莱米每帧 fragmentsInCoverage(onTray 排除拼接盘+光池 coveragePoolHalfHeight 钳不照盘), 点手电 cycleLight→红/黄/蓝/灭, 点拼片=拾取+灭灯, `physicsSettled&&flashlightAcquired` 双门控(不挡开场)。config flashlightCoverage{radius:150,centerOffsetY:-52}。
6. **修复动画 v1**(`f969e80`+`9c82d5e`): `M01RepairSequence` 纯时序(config repair.steps 数据驱动)→ bootstrap 完成后播【齿轮转→碎片漩涡**喷出**→星光脉冲】, 播完才出智慧结晶卡。镜头拉远无相机系统, 省略(电影化留美术轮)。

**⚠️ 待 live 验收(Cocos MCP 本轮断线, 未 refresh; 用户 Stop→Play 清单)**:
① 收耳后大小(renderScale 曲线观感, 旋钮=契约里各动作 renderScale) ② 顶篮: 篮子弹起+被绳拽着乱晃手感(`BASKET_KICK_STRENGTH` 600/`ROPE_OPTS`/`ROPE_TAIL_INV_MASS`) ③ 够不着 beat 观感(reachmiss fps 18) ④ 手电: 1/5 大小/光池跟随/循环灯色/覆盖面显色/点拼片灭灯 ⑤ 双门控不挡开场 ⑥ 完成→修复动画→卡片 ⑦ 已知边缘: 手持手电与拼片重叠时节点抢点(点到手电不拾片, F2 agent 记录) ⑧ smoke .mjs 两脚本仍旧手电时代(待预览可用后重写)。
**遗留(非阻塞)**: bootstrap 两个本轮前就有的孤儿函数(`addTargetReferenceCircleFrame`/`drawStandardPieceShape`); walk-00 身高 97% idle(630936e 已签收过, 未动)。

## 莱米动画资产现状(2026-06-08 收口)
11 套帧动作全接入 `LemmyActorContract`(idle24/walk48/reach36/**reachmiss40**/startle29/crouch40/earsback40/idleback48/walkback28/earsup38/headbutt124), 512²、脚底行恒 490、源视频全归档 `assets/art/characters/lemmy/source-videos/`(重抽方法 README+skill `jimeng-video-to-sprite-frames`)。canonical 拆分: pencil 版(游戏/即梦输入)+trademark 版(商标)。renderScale 见上。量具: `scripts/lemmy-measure-framesets.py`(重抽后必须重测重定曲线)。

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
(↑此剧情改版连同后续顶篮迭代,已于 2026-06-12 全部实现并回写 spec,见顶部「当前活跃线」;开场叙事现为: 够不着教学 beat → 顶篮分批撞出 → 手电砸头 → 蹲拾 → 手持观察。)
**M01 手电交互最终定(v4,2026-06-03,spec §5.2 已据此改)**:**推翻 v3 的"固定三按钮工具 / 固定光束"**——手电是莱米**手持**的,固定光束讲不通。最终模型:莱米捡起手电后手持;**点手里的手电**循环 红→黄→蓝→灭(手电小,无需精准点按钮);**点地面空白**莱米走过去、手电**覆盖面(不止1片)随莱米移动**扫照;覆盖面内候选碎片按当前灯色显色,移出/灭即恢复灰白;**点某拼片 = 玩家拾取(拼片随指针、非莱米去捡)并使手电熄灭**;拼片由玩家拾放、莱米只负责持手电。代码:代码里**现有两套手电机制(固定光束路径 + 手持指针拖动路径)全删**(含旧 `heldFlashlightId` 约20处引用、`revealAllFragmentsWithActiveFlashlight` reveal-all);只保留底层显色/选色模型并**新增 `clearFlashlight()`(灭态)**;覆盖面光束**新建**、锚到莱米(新字段 `flashlightAcquired`/`lemmyFlashlightNode`/`activeLightState`,不复用旧名)。`physicsSettled && flashlightAcquired` **仅**门控正式拼接/拾放片/底光验证,**不**挡开场走位/点篮/点掉落手电。config 实路径 `assets/resources/configs/stage1/m01-memory-gear.json`(load `configs/stage1/m01-memory-gear`)。**v4 计划(`docs/plans/2026-06-03-m01-intro-frame-anim-plan.md`)Task 1-10 已于 2026-06-12 全部执行完毕**(Task8 删旧/Task9 新接线/Task10 验证见顶部), 此段仅留作设计依据。**Claude 本环境实测 cocos MCP 在线可用**(可自做 refresh/reimport/scene 查询)。但**预览服务器起停 MCP 与 HTTP(:3000) 都返回 "not supported"**(2026-06-03 双复验)——`.ts` 改动重编译须在编辑器**手动**重启预览(Project>Preview),**Codex 也做不到、无额外能力**;Codex 走 HTTP 只是做 refresh_assets。
**M01 灯泡组件候选(2026-06-05)**:按用户要求用 Ideogram V4 `/v1/ideogram-v4/generate` 生成,不是 remix;4 张风格参考图在 `docs/design/generated-stage1-intro-art/ideogram-style-refs/bulb-style-ref-*.jpg`,调用字段 `style_reference_images`。已出 4 个独立候选源图 `docs/design/generated-stage1-intro-art/m01-bulb-ideogram-generate-v4-style-refs-v3-option-{1..4}.png`,并本地抠出透明版 `...-transparent.png`;预览拼图 `m01-bulb-ideogram-generate-v4-style-refs-v3-transparent-contact-sheet.png`。当前观感:2/4 更像可用游戏组件,1 偏旧灯泡,3 偏大和真实。
