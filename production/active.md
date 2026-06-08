# Active Work State

Last updated: 2026-06-08

> 这是**当前状态薄层**(CLAUDE.md 要求)。已完成的历史流水归档在 `production/archive/`,细节查那里或 `git log`。

## 当前活跃线:M01 顶篮 headbutt + 耳后贴动画 + 点哪走哪(2026-06-08 代码全落地, 待 live 验证) + canonical 描边拆分(2026-06-07)

**Z. 2026-06-08 接 session handoff 的 live 反馈修复(已落地·未 commit;typecheck ✅ + 337 测试全绿;⚠️待 live)**
死掉的 session handoff(API ECONNRESET)死在诊断"收耳后兔子变小"。复现量化:**收耳后身体真缩 25%**(idle 去耳身高 404 → idleback 302 = 75%;总轮廓 430→311;脚底线恒 490 不漂),耳朵折叠只占 17px,**其余是身体被归一化缩了**(根因:折耳源姿势更正面/更胖, 当初按躯干宽归一化→身高被压)。~~用户拍板根治法 = 重抽 4 套折耳帧~~ → **2026-06-08 用户改主意: 不重抽**, 改为**代码把折耳身体等比放大到与 idle 一致**(= 我最初推荐的折中放大方案; 在 actor 加逐动作 renderScale、脚底锚定、可 live 微调)。⚠️**排在当前修复(含下方绳子物理)之后再做**——"等修复完再改"。
随后用户给 4 条 live 反馈, 均已改 `M01IntroSequence.ts`(+ 契约 frameIndex):
1. **走向篮下靠近就收耳**(不是撞篮才收): 新 `roamLemmyTo`——点地目的地在 under 容差区(`isXUnderBasket`)→ 普通走到"到位前 `HEADBUTT_FOLD_LEAD_X`=70"处 → earsback 收耳 → walkback 耳后贴走完最后一段 → idleback。走出 under 区且已折 → earsup 抬耳再普通走。新增 `earsFolded` 态;`beginHeadbutt` 已折则跳过收耳;`handleStageTap` 改调 `roamLemmyTo`。
2. **起跳"碰到篮子"就受力**(不是到最高点): contact 帧 `LemmyActorContract` **#71→#66**(逐帧测头顶 Y:#60→165 #63→112 #66→87 #72→77峰值/贴篮底到#96;脚离地最高才#81。#66=上升段初次触篮底, 距峰值仅10px;旧#71=被篮底挡停的峰值=玩家眼里"到顶才受力")。测试措辞同步改。
3. **手电掉出后仍点哪走哪, 点掉地手电才拾起**: `handleStageTap` 放开 `waitingPickup`(原仅 roaming)+ 加 `pickupInProgress` 守卫;点手电仍 `handleFlashlightTap`→`beginPickup`(节点分层路由不变)。
4. **手电缩到莱米身体 1/5**(原 50×128 几乎与兔等高): `FLASHLIGHT_DISPLAY` 改为派生 `FLASHLIGHT_VISUAL_HEIGHT = round(LEMMY_DISPLAY.height×430/512/5)≈30`(保 50:128 瘦长比→≈12×30)。视觉精灵移到子节点, 父节点=点击区 `max(尺寸,FLASHLIGHT_TAP_MIN=44)` 解耦(缩小后仍好点中)。
**Cocos 已 `project_refresh_assets db://assets/scripts` 重编译**;待用户 **Stop→Play** live 验证。可调旋钮: `HEADBUTT_FOLD_LEAD_X`(收耳提前量)/ earsback·earsup fps(折/抬耳时长, 现 24, 嫌停顿久可提)/ contact `frameIndex 66`(受力时机)/ `FLASHLIGHT_VISUAL_HEIGHT` 的除数 5(手电大小)/ `FLASHLIGHT_TAP_MIN`。

**Z2. 篮子绳子物理(2026-06-08;用户选 Cocos 引擎关节,分层落地;typecheck ✅ + 337 绿;⚠️待 live)**
用户:"篮子受力时绳子要按真实物理跑, 不是现在脚本式硬顶"。调查:篮子非物理体(脚本 `basketJolt` 纵移 + `gentleNudge` 转角);绳子**画死在篮 PNG 里**(琥珀 amber, 鳄梨改色后 amber 铺满全图→颜色蒙版扣不准, 用户也抱怨过)。**关键技术坑**: 分批顶篮(每次3片/共3次)hit1 后还有6片冻结在篮里, 若篮子此刻变动态体, 冻结的静态拼片不会随动态父体摆→脱节; 重做已验证的暂存逻辑风险高。
**最终方案(避开 Cocos 刚体/关节, 用自研 Verlet 软绳承重 + 节点位移驱动篮子 → 绕开冻结拼片脱节)**:
- **美术**: `scripts/m01-basket-strip-suspension.py`(区域法: 按行宽突变定 rim=y567, 抹其上吊带/吊钩; 原图备份 `/tmp/m01-basket-backup/`)把 `m01-basket-hanging-empty.png` 抹成**纯碗体**(不透明 y[67,929]→[567,929])。
- **篮子竖直 = 1D【不可拉伸软绳】模型(非弹簧)**(用户两轮校正: "篮子会蹦但受软绳约束" + "不是弹力绳只是软绳"): `update` 里 `basketSuspY/VY` 受 `BASKET_GRAVITY`(-1800)弹道运动, `basketJolt` 给 `BASKET_KICK_STRENGTH`(600 px/s)上抛初速度 → 升起(绳松弛)→ 落回到 `ropeLength` 那刻**硬接住、不回弹**(inelastic clamp, 非弹簧来回弹)。x 恒在钉下=只竖直不左右晃。`basketNode.setPosition(0,derivedY)` 节点位移驱动(内胆/冻结拼片自然跟随, 不引刚体→无脱节)。
- **绳子=纯视觉 Verlet 链**(不再承重): 两端钉(钉子 + 篮挂点=basketSuspY), 中段点受 `ROPE_GRAVITY` 自垂、只拉不推约束 → 软绳观感(篮被顶起=链松→垂)。`drawRope` 渲为**两股吊带**: 同链渲两次, 横向偏移 ±`STRAP_HALF_WIDTH`×t(钉处汇聚→篮处分到**两耳打结处** ±99, 实测原图 y545 接篮于中心±361img×433/1586≈±99)。
- **修过的 bug**: ① 绳看不到 = 用 `worldPosition`(绝对)在节点局部空间画→双重偏移到屏外; 改 `nailPoint/basketAttachPoint` 局部坐标。② 篮子"头穿过去" = 旧 `basketJolt` tween 0.21s 弹回太快(头贴篮 #66–96≈0.75s), 改物理弹跳。③ 单股→双股(原图是两吊带)。④ 弹簧感→不可拉伸 inelastic。
- 旋钮: `BASKET_KICK_STRENGTH`(蹦多高)/ `BASKET_GRAVITY`(落速/滞空)/ `STRAP_HALF_WIDTH`(两耳间距)/ `ROPE_WIDTH/COLOR/POINTS`/ `ROPE_GRAVITY/DAMPING/CONSTRAINT_ITERS`(视觉链垂感)。⚠️**待 live**。gentleNudge(侧边轻碰)仍 pivot 转角、绳暂不跟(小瑕疵)。

**A. 莱米 canonical 描边拆分(已落地,⚠️未 commit;typecheck ✅ + 311 测试全绿)**
- 拆成两张母版(同一只兔,差在描边):
  - **游戏动态/即梦输入身份 = 带铅笔描边版(W5)**:`assets/art/style-references/lemmy-rabbit-canonical-pencil.png`(2000²透明) + 白底即梦输入 `…/source-videos/lemmy-firstframe-pencil-white.png` + 日期归档 `docs/design/style-references/2026-06-07-lemmy-rabbit-canonical-pencil.png`(三张已 git add)。
  - **商标/logo = 干净无描边版(W1)**:`lemmy-rabbit-canonical.png` **git mv→** `lemmy-rabbit-trademark-master.png`(png+meta 一起,保 UUID)。
- 接线:`LemmyActorContract.ts` 两常量重指(APPROVED_IDENTITY→pencil、CLEAN_MASTER→trademark)、`LemmyActor.test.ts` 断言更新、`M01GreyboxArt.ts` sourceFile→pencil。两处 README + 记忆 `project_lemmy_canonical_identity` 已同步。
- **产线变更**:新动作从 pencil 输入生视频→**描边已烘进,跳过 `scripts/lemmy-pencil-outline.py`**;⚠️旧 5 套源视频是干净首帧生成的,重抽仍需该脚本。验证:量化对比确认 pencil 版 = 在用帧描边(W5/grain0.45 中间档),非 W8 重描实验版。

**B+C. M01 顶篮 headbutt + 点哪走哪 + 耳后贴 5 套动画(2026-06-08 全部代码落地;⚠️未 commit;typecheck ✅ + 335 测试全绿;⚠️物理手感待 live 验证)**

*5 套「耳后贴」动画(已抽帧·落 resources·建 meta·Cocos 已 refresh 注册):*
- earsback 40 / idleback 48(循环 2.0s 呼吸) / walkback 28(循环 0.8s/步) / earsup 38 / headbutt 124(蹲→跳→落) 帧,均 512² 透明、统一缩放对齐 idle 躯干宽 131(身高约 306、比 idle 386 矮一截=用户定的取舍, 宁矮不胖)。headbutt 用 3 位补零(避免 100>99 字符串排序乱)。
- **大小一致方法**(几十轮调试核心收获)已沉淀:skill `jimeng-video-to-sprite-frames`「保持大小一致·进阶」节 + 记忆 `project_sprite_size_consistency_methodology`。`extract-frames-bodynorm.py` 新增:目录模式(绕 mpdecimate 密集抽)/ `target_body_ratio` / `uniform_torso`(耳动转换片统一缩放治抖)/ `jump_mode`(地面线锚定保腾空)/ 动态补零。
- ⚠️**耳姿实际是 lop 垂到脸颊两侧、非"后贴脑勺"**(即梦这么画的, 用户接受了, 全程按现状定的尺寸/节奏); headbutt-source 实为"蹲地起跳"(0.6s蹲/2.2s腾空/3.3s落)。

*代码(全绿):*
- 契约 `LemmyActorContract.ts`:`LemmyFrameActionId` 加 5 个 id;`LemmyActorEvent` 加 `headbutt_contact`;`LEMMY_FRAME_ACTIONS` 加 5 条(headbutt 在 #105 顶点发 contact)。
- `LemmyActor.ts`:`walkTo` 加 `action: walk|walkback` 选项;原地点击不强翻朝向。headbutt 经通用 `playFrameAction` 播放。
- 相位机 `M01IntroFlow.ts` **重构**:`approaching→roaming(自由走)→folding(收耳)→headbutting(跳)→spillingFragments→…手电不变`。事件改 `headbuttStarted/foldDone/headbuttContact`。
- `M01IntroSequence.ts`:`handleStageTap`+`walkLemmyTo`=点哪走哪(左右镜像, 边界 clampStageX);`handleBasketTap`→`beginHeadbutt`:走到离正下方 `HEADBUTT_APPROACH_FOLD_DX`=130px(正常走)→`earsback` 收耳→`walkback` 耳后贴走完最后一段到正下方→`headbutt` 帧(**自带腾空, 无引擎 jumpArc**)→**#71** `headbutt_contact`→`commitHeadbuttSpill` 给篮内拼片**向上+外扩**真实冲量 `applyHeadbuttImpulse` 取代脚本 `BASKET_SPILL_FLING_*`。删了 reach/tip 流程。
  - **⚠️ 2026-06-08 现场调参(用户 live 重测中)**:① 冲量两轮下调到**原始 200/95/45/220 的 1/10 = 20/10/5/22**(先 200→130 仍"太大", 再到 1/10——拼片只轻推一下靠重力落出);② **删引擎 `jumpArc`**(那一下=多一次原地跳, 和 headbutt 帧自带腾空叠成"跳两次"), 起跳全靠帧;③ 走向篮下**接近时就收耳→耳后贴走入**(原"到位才收耳");④ **点篮位置判定**(用户现场两轮: 先要我"一律顶", 后改回): `isLemmyUnderBasket`(|x-320|<`LEMMY_HEADBUTT_UNDER_TOLERANCE`80)→ `beginHeadbutt` 顶篮; 不在篮下 → `beginBasketReachNudge`(走近 `LEMMY_BASKET_REACH_X`230、不进正下方 → `reach` 够篮底边 → `gentleNudgeBasket` 柔晃, 不改相位/不收耳/不顶)。玩家流程=点地走莱米到篮下→点篮顶;别处点篮=走近摸一下篮子晃晃;⑤ **contact 帧 #105→#71**:实测头顶 Y 在 **#71(1.77s)就升到最高并贴篮底到 #99**, 而 #105(2.62s)时头已回落 → 篮子晚 ~0.9s 反应=不协调。**经验:带腾空的顶/够类动作, contact 要对【相关肢体(头/爪)的峰值帧】, 不是脚离地最高/整体 bbox 峰值——肢体先伸到位并停留、身体随后才到最高, 两者能差近 1s。** 量法: 逐帧测该肢体 Y 的最小值首达帧。

*手电砸头→拾起叙事(2026-06-08 已实现, spec §5.2)*:倒篮后 `single_flashlight_tool` 精灵从篮口脚本化弧线掉到莱米头顶→`startle` 受惊→弹落脚边地面→点它→莱米走过去`crouch`蹲下拾起→`acquired`(发 `onFlashlightAcquired` 可选回调, bootstrap 暂未接=空)。驱动相位 `spillingFragments→bonking→waitingPickup→pickingUp→acquired`。`M01IntroSequence`: `spawnIntroFlashlight`/`beginFlashlightDrop`/`handleFlashlightTap`/`beginPickup`。

**⚠️ 待 live 验证(我无法自验:.ts 改动需手动重启 Cocos 预览;物理/编排手感像基篮堆叠一样要现场调)**:① headbutt 跳起头是否够到篮底(`HEADBUTT_JUMP_RISE=70`)② 向上冲量顶出 9 拼片的力度/散布(`BASKET_HEADBUTT_IMPULSE_*`)③ 点哪走哪+左右镜像 ④ 收耳→跳→落→idleback 衔接 ⑤ 侧边 walkback 晃 ⑥ headbutt 124帧@40fps≈3.1s 偏长可能要提 fps ⑦ 手电掉落弧线/砸头点/落地点(`FLASHLIGHT_*` 常量)+ startle 由耳后贴态弹成耳竖的观感 ⑧ 蹲下拾起后手电锚点(现简化贴身前)。
**已实现(2026-06-08)** ✅ **可重复顶篮(顶一下出一批、反复顶到全出)** + **篮子被顶起**:用了"不动 bootstrap 的低风险版"——早批走手动弹道自然落地、**只最后一批调 onSpill** 交 physicsPile 整堆沉降→开谜题。每顶 `HEADBUTT_PIECES_PER_HIT`=3 片(顶层优先 `headbuttReleaseOrder`),3 次清空。`basketJolt` 改为**整篮(含内胆+剩余拼片)纵向上顶 `BASKET_HEADBUTT_KICK_UP`=30px**(不再左右旋转摇摆——用户"篮子要被顶起")。337 测试绿(+2 readyToHeadbutt 回环测试)。⚠️仍待 live:多批落地物理观感、每批数量/力度手感。实现细节如下(也是当初计划):
  - **相位机 `M01IntroFlow`**:加 `readyToHeadbutt` 相位 + `piecesRemain` 事件;`spillingFragments` 多一条边 `{ piecesRemain: "readyToHeadbutt" }`(与 `fragmentsSettled: "bonking"` 并存,cc 按"是否还有片"喂哪个);`readyToHeadbutt: { headbuttStarted: "headbutting" }`(再点篮直接顶、跳过 earsback/walkback,已在篮下耳后贴)。
  - **`M01IntroSequence`**:拆 `beginHeadbutt`(首次:approach+earsback+walkback+strike)与 `beginRepeatHeadbutt`(重复:仅 strike)→ 共用 `playHeadbuttStrike`;`handleBasketTap` 按 phase 分派(roaming→首次 / readyToHeadbutt→重复);加 `headbuttReleasedCount` + `HEADBUTT_PIECES_PER_HIT`(建议 3, 9÷3=3 顶);`releaseFragmentsFromBasket`/`applyHeadbuttImpulse` 改为**按"顶层优先"释放下一子集**(PILE_OFFSETS 反序≈顶层先, 索引 8,7,6 → 5,4,3 → 2,1,0);strike 结束后:还有片→`idleback`(留在篮下耳后贴等再点)/ 全出→`onSettled`+`beginFlashlightDrop`(现逻辑)。
  - **physicsPile 已验证可行(2026-06-08 读 M01PhysicsPile.startDrop)**:`startDrop` 每次 `this.options=options` + 重置 `settled/settleCheckArmed/stableSettleFrames`,所以**支持多次调用各掉一批**(`releaseInPlace`→`engagePiecesInPlace` 只激活传入的 fragments)。需改:① bootstrap `onSpill(originX,originY)` → 收**子集** `onSpill(subset, originX, originY)`,只把该批 fragments 传 `startDrop`;② **门控 final settle**:`onSettled`(置 `physicsSettled=true` 开谜题)只能在**最后一批全出**那次触发——否则第一批落地就误开谜题工作区。做法:bootstrap 记 `introReleasedCount`,只有 `==9` 那次的 `startDrop.onSettled` 才置 `physicsSettled`。③ 早批 fragments 已 Dynamic 在沉降,后批 `startDrop` 不要 zero 它们的速度(`engagePiecesInPlace` 只动传入子集即满足)。**风险**:多批落地物理观感(早批被后批顶/挤)需 live 看,故仍建议单次手感锁定后一并 live 调。
  - 测试:`M01IntroFlow.test` 加 readyToHeadbutt 回环 + piecesRemain 分支;scaffold 加 `beginRepeatHeadbutt`/子集释放断言。② **flashlight v4 手持功能道具**(三色循环/光束/拾放)= 独立大计划,active.md 历史明确"执行前最后确认、尚未开工",**需你拍板才动**;当前 `acquired` 只到"手电到手"的叙事终点、`onFlashlightAcquired` 留作接它的钩子。

## 当前活跃线:M01 开场「拼片在篮子里→随篮摆→摔出」(2026-06-06)

**用户目标**:空篮子里放 9 个**真实标准件拼片**(`M01_STANDARD_PIECE_DISPLAY_SIZE` 56×56),随篮摆动,点篮后倒出;要**前壁遮挡**。装篮要按标准件尺寸;用 **Cocos 物理引擎自然堆叠**(标准件装不满一层以上→会堆出鳞边,用户**接受堆高观感**,不缩小拼片)。

**美术(已落地 + reimport)**:
- `…/intro/m01-basket-hanging-empty.png`(空篮,1586×992;已色调匹配原篮 H39/S38/V74、黑底洪水填充抠透明、`trimType none`)——codex/并行已放,我已验证色调与抠图干净。
- `…/intro/m01-basket-front-occluder.png`(前壁遮挡)——**陶土旧版已弃(用户:扔了)**,改为**从空篮抠出的藤编前壁**(脚本 `scripts/m01-extract-front-occluder.py`,CUT=625 前沿唇线),1586×992 `trimType none`,uuid 不变,已 oxipng + reimport。
- 工具脚本:`scripts/m01-basket-tone-match.py`(数据驱动色调匹配)、`scripts/m01-extract-front-occluder.py`(抠前壁)。

**代码改动(typecheck ✅ + 311 测试全绿;⚠️未 commit)**:
- `M01GreyboxArt.ts`:`intro_basket_hanging` 资源指向 `m01-basket-hanging-empty.png`(原带画死拼片的 `m01-basket-hanging.png` 不再被引用,真实拼片得以透出)。
- `M01IntroLayout.ts`:新增 **`M01_INTRO_BASKET_SCALE`**(=1.6,**一个旋钮整套等比放大**:display + 物理碗 + 掉落种子 + 钉高,**拼片保持 56×56 不变**)——因为标准件在原尺寸碗里物理堆叠仍装不下,用户要求放大篮子直到装得下。`wallTopY 74→130`(再×scale)兜住堆叠。`PILE_OFFSETS` 当**掉落种子**(随 scale 等比)。`M01GreyboxArt.test.ts` 旧「画死拼片读作标准件尺寸」测试已改为「空篮+放大旋钮」语义。
- `M01IntroSequence.ts`:`stageFragmentsInBasket` 由「手摆 Static 隐藏」改为**物理掉落**(`active=true` + `Dynamic` + `gravityScale=1`)→ `scheduleBasketPileFreeze`(`BASKET_PILE_SETTLE_MS=900` 后冻结 Static,使堆叠随篮**刚性**摆动)→ 倒出时 `releaseFragmentsFromBasket`+`startDrop` 复用既有 spill。`init` 里新增 `spawnBasketFrontOccluder()`(在 stage 之后=最上层,盖住拼片下半截)。`startSpill` 删 `swapSprite(basketTipped)`(空篮直接转,不再闪陶盆);删 orphan `swapSprite`。`spawnRopes` 仍 dead(空篮已画死绳/链;`noUnusedLocals` off 不报错)——**已于 2026-06-08 死代码清理移除**(连 `ROPE_*` 常量 + `rope` SpriteKey + `intro_rope_segment` manifest/union)。

**✅ 已在 Cocos 预览 live 调通(用户逐项确认,2026-06-06)** —— 物理掉落+碗里自然堆叠成立。最终定稿参数(均在 `M01IntroLayout.ts`):
- `M01_INTRO_BASKET_SCALE = 1.12`(过程:1.6 太大→1.08/1.19 不够包→1.4 包住但偏大→缩 20% 到 **1.12**=原始的 112%。display 433×271)。
- `M01_INTRO_BASKET_CAVITY_Y_SHIFT = -15`(内胆整体相对篮子下移 15px,对齐碗内底)。
- 内胆几何:`floorY -74`、`wallTopY -25`、`bottomHalfWidth 126`、`topHalfWidth 149`(均 ×scale + shift)。侧壁**离垂直 ≈25°**、长 ≈76px(由 wallTopY+topHalfWidth 联合定;改长度/角度要同时动这两个数,保 `hypot(dx,dy)` 与 `atan(dx/dy)`)。
- `WALL_X_INWARD_NUDGE = 40`(**两壁对称内移**:左壁 +x、右壁 −x;原 `LEFT_WALL_X_NUDGE` 只动左壁→右壁跑出画布右缘被裁,改对称后两壁各距篮心 ±114、都在画布内)。
- 矮墙模型:`isInsideCavity` 去掉了 `offset.y > wallTopY` 顶棚判断(掉落种子可在矮墙之上,拼片从上落入);测试不变量 `floorY < wallTopY`(原 `frontOcc < wallTopY` 已改)。separation tolerance 复位 0.75。
- 调试浮层已关(`debugDrawFlags = 0`)。

**⚠️ 仍未 live 验证:点篮→倾倒→拼片倒出**那一段(用户只看了静态堆叠态,没点穿开场)。用户提过"墙太高会把拼片困住倒不出"——已把墙压到正常高度(25°/76px),理论上能倒;但**倒出顺畅度未实跑**。(旧兜底 `destroyBasketInnerCavityAfterReleaseGuide` / `releaseGuideMs=650` 延迟销墙**已于 2026-06-08 移除**;headbutt 的 `commitHeadbuttSpill` 已即刻 `destroyBasketInnerCavity()` 销墙。)

**Cocos 预览刷新铁律(本会话踩实)**:.ts 改动**光浏览器刷新不生效**,必须编辑器内 **Stop→Play**;用 MCP `project_refresh_assets db://assets/scripts` 可强制重新编译(本会话每次改完都调,然后让用户 Play)。computer-use 点 Cocos 的 Play 被一个隐形「程序坞」覆盖窗拦截(点不动);Chrome 只读层能截图看、`project_stop/start_preview_server` MCP 不支持→预览重启只能用户手点。

**可调旋钮**:`M01_INTRO_BASKET_SCALE`(整套大小)、`CAVITY_Y_SHIFT`(内胆上下)、`WALL_X_INWARD_NUDGE`(两壁内外)、`wallTopY`+`topHalfWidth`(墙长+角度)、`BASKET_PILE_SETTLE_MS`(沉降时长)、occluder `CUT`(重跑 extract)、`BASKET_SPRITE_BOTTOM_Y`/`BASKET_X`(位置)。
**清理项(非阻塞)**:`m01-basket-tipped.png` 现已不用;~~`spawnRopes`/rope 资源 dead~~(**已清 2026-06-08**:spawnRopes + ROPE_* + rope SpriteKey + intro_rope_segment manifest/union;rope PNG/`.meta` 仍在盘上未删);`scripts/m01-basket-tone-match.py`、`scripts/m01-extract-front-occluder.py` 为本轮工具。
**⚠️ 整轮改动未 commit**(等用户)。typecheck ✅ + 311 测试全绿 ✅。

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
