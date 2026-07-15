# 莱米动作源视频归档

这些是即梦(dreamina/Seedance 2.0)生成的**原始动作短视频**,是莱米所有逐帧动画的源头。
**永久保留**——以后任何动作想加密(多抽帧让动画更顺),直接从这里重抽,不用再花积分重新生成。

## 文件清单

| 源视频 | 对应动作 | 已抽帧数 | 运行时帧目录 |
|---|---|---|---|
| `lemmy-idle-source.mp4` | 待机(呼吸+耳朵微动) | 24 | `assets/resources/art/characters/lemmy/idle/` |
| `lemmy-walk-source.mp4` | 走路(**正面3/4**,小幅晃;area-norm锁尺寸) | 48 | `assets/resources/art/characters/lemmy/walk/` |
| `lemmy-reach-source.mp4` | 够篮(踮脚伸手) | 36 | `assets/resources/art/characters/lemmy/reach/` |
| `lemmy-startle-source.mp4` | 受惊(被砸→低头→吃惊瞪眼→恢复) | 29 | `assets/resources/art/characters/lemmy/startle/` |
| `lemmy-crouch-source.mp4` | 蹲下(站定→下蹲→蹲住,准备拾取) | 40 | `assets/resources/art/characters/lemmy/crouch/` |
| `lemmy-earsback-source-v2.mp4` | **耳后贴①收耳**(立耳→放下贴脸颊;seg 0-2.0s 收耳段) | 40 | `…/lemmy/earsback/` |
| `lemmy-idleback-source.mp4` | **耳后贴②待机**(耳后贴呼吸;单呼吸周期 seg 2.07-3.07s 循环复用) | 48 | `…/lemmy/idleback/` |
| `lemmy-walkback-source.mp4` | **耳后贴③走路**(耳后贴迈步;单步 seg 2.47-2.93s 循环) | 28 | `…/lemmy/walkback/` |
| `lemmy-headbutt-source.mp4` | **耳后贴④顶篮=蹲地起跳**(0.6s蹲蓄力→2.2s腾空脚离地→3.3s落;seg 0.4-3.5s) | 124 | `…/lemmy/headbutt/` |
| `lemmy-earsup-source.mp4` | **耳后贴⑤展耳**(耳后贴→立起复原;seg 1.6-3.5s 抬耳段) | 38 | `…/lemmy/earsup/` |
| `lemmy-nod-source.mp4` | **点头**(2026-06-16 误生成:想要左右摇头、即梦出了上下点头;留用, 说不定后面用得上) | 27 | `…/lemmy/nod/` |
| `lemmy-headshake-source.mp4` | **正脸左右摇头="不行"**(v9 正脸定妆 frames2video 首尾双锁;够不着 beat 用;抽帧只取第一次摇·fps8) | 15 | `…/lemmy/headshake/` |
| `lemmy-startleback-source.mp4` | **耳后贴⑥受惊**(收耳状态被砸→低头→瞪眼→恢复;frames2video 首尾双锁收耳锚图 f1=f120 直立;uniform_torso=131,pencil-baked 跳描边)。**2026-06-28 重抽为非均匀 20 帧**(治"回正显跳"): 源弧=直立→耳惊飞→深蹲(f19-31)→深蹲保持(f28-85 几乎静)→慢回正(f85-113)→直立(f120)。旧 uniform 把半数帧浪费在静止深蹲、回正仅 9 帧;新抽=缩头 5 帧(源 f19,23,26,28,31)+回正 15 帧密集(源 f85-113 每2帧),剔除铺垫与深蹲保持。**二次精修→14 帧**: 删平静起手+耳惊飞 2 帧(起手即低头缩身)+删源重复帧(即梦有效帧率<60 带进的零运动帧, 按相邻 diff<1 判)。pacing 在 `LemmyActorContract`: fps100/peakFrame2/hold420/tail16,无 skipLeadFrames(反应快慢只调走帧速度不砍帧)。 | 14 | `…/lemmy/startleback/` |
| `lemmy-crouchback-source.mp4` | **耳后贴⑦蹲下拾取**(收耳状态 站→蹲→前爪触地→起身;运行帧只取下蹲段,起身反播) | 28 | `…/lemmy/crouchback/` |
| `lemmy-firstframe-earsback-pencil-white.png` | 耳后贴锚图(白底,frames2video 锁②③④⑥⑦尾) | — | — |
| `lemmy-firstframe-white.png` | 旧首帧(**干净无描边** canonical 白底版;最早 5 套源视频用它生成) | — | — |
| `lemmy-firstframe-pencil-white.png` | **新首帧(2026-06-07,带铅笔描边 W5 白底版)**;新动作即梦生图用它,描边烘进画面 | — | — |

规格: 全部 1440×1440, 5s, 60fps, 去重后约 56-120 独立帧。运行时帧 **512²**(2026-06-05 起,旧版 384²)。

## 2026-06-05 全套重抽 + 对齐原图处理 (更顺滑)
5 套全部从源视频重抽、帧数加密、运行时尺寸 384²→**512²**(iOS+Steam 无包体限制,质量优先)。
每帧统一收尾链路:
1. 抽帧(下方对应脚本)→ 色彩迁移到 canonical;
2. **`scripts/lemmy-tone-match.py`** —— 把每帧身体 V 对比度拉到 canonical 的 `V.std=0.160`(治"抽帧+LANCZOS缩放后比定妆图发平",同口径实测帧只有 0.143);
3. **`scripts/lemmy-pencil-outline.py`** —— 浅铅笔灰外描边(W 按内容高度缩 / 0.45 颗粒 / 深浅不一)。**⚠️ 2026-06-07 起:仅"用干净首帧生成的旧 5 套源视频"重抽时需要这步;用带描边首帧 `lemmy-firstframe-pencil-white.png` 新生成的视频描边已内置,跳过此步(见下方 2026-06-07 节)**;
4. `oxipng -o4` 无损。
- ⚠️ **walk 专属一步:area-norm**(按整体不透明面积统一缩放锁尺寸)。即梦逐帧体积抖动~8-11%,**走路恒定大小会暴露成"忽大忽小"**;bodynorm 只锁身高治不了(宽度仍摆 26%),改**锁面积**(面积摆幅 11.6%→**0.7%**)即可,均匀缩放不变形。
- **walk 源 = 正面 3/4(已归档 `lemmy-walk-source.mp4`)**,非纯侧面(用户 2026-06-05 选定;纯侧面 crouch 源的宽度摆幅更大 34%)。
- `.meta` 为 512² 重建(`trimType: none` 满画布保逐帧脚底对齐;新 UUID,帧序列尚未接进 `LemmyActor`、无引用)。改帧后需在 Cocos 里 reimport 注册。

## 2026-06-07 描边改为「烘进即梦输入」(新动作不再逐帧描边)

角色身份基准 2026-06-07 拆成两张(详见 `docs/design/style-references/README.md` 的「2026-06-07 split」):
- **带描边** `assets/art/style-references/lemmy-rabbit-canonical-pencil.png`(W5 描边已烘进图) + 白底即梦输入 `lemmy-firstframe-pencil-white.png` —— **新动作(如顶篮 headbutt)从这张生视频**,抽帧后描边天然在画面里,**跳过 `scripts/lemmy-pencil-outline.py`**。
- **不带描边** `lemmy-rabbit-trademark-master.png`(旧 `lemmy-rabbit-canonical.png` 改名)= 商标/logo 原型,**不进动态管线**。
- ⚠️ **已有 5 套源视频(idle/walk/reach/startle/crouch)是用旧干净首帧 `lemmy-firstframe-white.png` 生成的** → 它们重抽时**仍要**走 tone-match + `lemmy-pencil-outline.py`。只有用 `lemmy-firstframe-pencil-white.png` 新生成的视频才省这步。
- ⚠️ **首次**用「烘进描边」输入生成后,抽几帧核对即梦是否稳定复现 W5 浅铅笔描边(粗细/颗粒);若走样,回退「干净输入 + 每帧 `lemmy-pencil-outline.py`」老法。

## 2026-06-08 耳后贴 5 套 + 「保持大小一致」进阶(完整方法见 skill jimeng「保持大小一致·进阶」节)
- **跨片对齐量躯干宽不量身高**(躯干在耳下、不受耳动干扰):全部统一缩放对齐 idle 躯干宽 131(`uniform_torso` 参数)。
- **耳朵在动的转换片(earsback/earsup)用统一缩放**(全帧一个系数),不能逐帧按身高归一(head_top_y 被动耳干扰→身体忽大忽小)。
- **循环只抽一个相位闭合周期**(idleback 单呼吸/walkback 单步, 图像差自相关找无缝点)循环复用, 省内存;**圈内密集抽**(目录模式绕 mpdecimate)。回放快慢=帧数/fps。
- **headbutt 跳跃用 `jump_mode=1`**(按源地面线锚定, 保脚离地腾空; 脚底锁地会压平跳)。>99 帧动作 3 位补零(防 loadDir 字符串排序乱)。
- `extract-frames-bodynorm.py` 本轮扩展: 目录模式 / `target_body_ratio` / `uniform_torso_px` / `jump_mode`。命令示例: `extract-frames-bodynorm.py <帧目录> <pencil> <出目录> headbutt 1 0 1 0.598 131 1`。

## 怎么重抽帧(加密/调整)

用 skill `jimeng-video-to-sprite-frames` 的脚本:
```
python3 .claude/skills/jimeng-video-to-sprite-frames/scripts/extract-frames.py \
  assets/art/characters/lemmy/source-videos/lemmy-walk-source.mp4 \
  assets/art/style-references/lemmy-rabbit-trademark-master.png \   # 旧干净源视频重抽: 干净版做色彩参考, 之后仍需 lemmy-pencil-outline.py
  assets/resources/art/characters/lemmy/walk walk 48     # 把36改成48即加密
```
- **待机**(循环、身高应恒定、耳朵基本不动): 用 `extract-frames.py` 的逐帧等高归一化
- **够篮 / 受惊 / 蹲下**(有蹲→伸 / 低头→抬头 / 站→蹲的高度弧线): 用 `extract-frames-arc.py`(统一缩放+脚底锁定+主簇bbox),**不要等高归一化**否则毁掉弧线
  - 蹲下: `extract-frames-arc.py lemmy-crouch-source.mp4 … crouch 24 0.5 1.0`(seg 0.5–1.0 只取"站定→蹲下→蹲住";源视频前半段是没走起来的弱走路、弃用)
- ⚠️ **走路(正侧)别再用即梦抽帧了**: 2026-06-02 试过用即梦生成纯正侧走路,即梦逐帧把身子"画胖画瘦"~10%(固有抖动,等比缩放修不掉),走路要求大小恒定→暴露成忽大忽小。最终走路回退到**第一版斜侧 walk** + 引擎横移。**必须恒定大小的循环走路/待机走引擎变换,别指望即梦帧。**(详见 skill 注意/坑)

## ⚠️ 受惊(startle)重抽须知:源视频里有「小果子」,运行帧是去掉的
即梦把 prompt 里的"小物件落到头顶"真画进了视频:一颗棕色小果先落在头顶、随低头弹动,约前 1s 出现后掉走。
用户要的是**不画出物件**,所以运行帧是这样得到的(不是直接抽):
1. `extract-frames-arc.py … startle 40 0.0 1.0` 先抽 40 帧(2026-06-05 加密版;旧版 30→23);
2. 棕果从 #0 上方下落、**#1–#12 贴头(污染)**、~#13 起弹走;arc 主簇 bbox 能剔除"悬空"高处果子,但贴头那几帧剔不掉;
3. **重组** = `[#0, #0] + #13..#39`(丢掉带果子的 #1–#12),得到 **29 帧**:中性→[跳过带果子的低头]→低头到底→抬头吃惊→恢复;
4. 再 tone-match + 铅笔描边 + `oxipng`(见「全套重抽」节;不再压到 384²)。
所以**直接重抽会把果子带回来**,必须按上面重组步骤剔除。
另:吃惊帧的眼睛是即梦的"大白眼+黑点"——试过 prompt 明确要求"只微睁、保持深褐圆眼珠"即梦仍画大白眼,合成褐眼珠被否决,最终采用即梦原样白眼。

## 为什么源视频在 assets/ 不在 temp/

`temp/` 被 .gitignore 忽略会随时丢失。这些源视频是不可再生的关键资产(重新生成要花积分且可能漂移),
所以放 `assets/` 进 git 永久保存。

## 朝向
莱米脸朝左 → 只能向左走;游戏里朝右用 `scaleX = -1` 镜像翻转,不需要单独存朝右源视频。

## 发行平台
iOS App + Steam(PC/Mac),无 4MB 包体限制,帧数可按动画质量需要给足(复杂动作可多抽)。

## reachmiss(2026-06-08, 伸手够不着教学 beat)
- `lemmy-reachmiss-source.mp4`: frames2video 首尾双锁 `lemmy-firstframe-pencil-white.png`(pencil 已烘, 抽帧后**跳过**描边脚本), prompt 动作段=踮脚伸手够两次够不到、放下手耳朵微耷拉失望、回站。
- 抽帧: `extract-frames-arc.py <mp4> lemmy-rabbit-canonical-pencil.png <out> reachmiss 40 0.08 0.96`(统一缩放保高度弧, 站姿躯干实测 102-103% idle、脚底 490)。

## nod(2026-06-16, 误生成的点头 — 留用)
- `lemmy-nod-source.mp4`: 本想生成"左右摇头"(submit_id `bf4041b9-b788-45d6-a993-20bb1e2c7fc6`, prompt 写了"头部左右摇"), 但**即梦理解成了上下点头**(AI 对头部俯仰/偏航常分不清)。用户判定是点头、要求改左右摇, 但**点头这套留着,说不定后面用得上**。
- 抽帧: ffmpeg 全 242 帧 → 窗口 f-019..f-097 每 3 取 1 → `extract-frames-bodynorm.py <帧目录> lemmy-rabbit-canonical-pencil.png <out> nod 24 0 1 0.754 131`(目录模式 + uniform_torso=131 统一缩放=idle 基准)。27 帧, 躯干 132/脚底 490 与 idle 一致, 在 `…/lemmy/nod/`(未接进契约, 要用时加 `nod` 动作即可)。

## headshake(2026-06-17 定稿, 够不着后的"不行"【正脸原地左右摇头】— 运行时取代 reachmiss)
- `lemmy-headshake-source.mp4`: frames2video 首尾双锁【v9 正脸定妆】(`assets/art/style-references/lemmy-rabbit-front-canonical.png`)白底, 正脸原地左右摇头。1440²/60fps/4s。
- 抽帧: bodynorm 目录模式 + uniform_torso=131(色彩参考用 v9 正脸定妆=不跑色), 归一脚底 490/totH≈430 与 idle 同屏高。**只取第一次摇**(head_x 中点 f14 回正处截断)→ 15 帧; contract fps 8(现场调 20→12→8)。
- **转脸方案已放弃**: v9 正脸=平面脸、侧脸定妆=立体脸, 几何不自洽 → 即梦转头中段必生鬼眼(frames2video 形变 / multimodal2video 全能参考都试过, 后者还要 Dreamina 网页一次性内容授权)。结论: 不做转脸, reach(侧3/4)→ 切到正脸摇头 → idle。
- 缘由链: 旧 reachmiss(踮脚两次失望)嫌不好看 → 引擎 tween 摇头=刚性整体晃被否 → 即梦只动头(第一版出成点头=见 nod)→ v9 正脸原地左右摇定稿。reachmiss 帧集留盘上可切回。

## celebrate(2026-06-30 定稿 v3, 通关庆祝"正脸蹦跳欢呼" — 两跳/闭嘴/耳朵柔和)
- 正源 `lemmy-celebrate-source.mp4`: frames2video 首尾双锁【v9 正脸定妆】(`lemmy-rabbit-front-canonical.png`)白底, 正面原地**只跳两下**、双前爪举起欢呼、**嘴始终闭合**、耳朵随身自然柔和摆动(不额外抖), 落回正面站立。submit_id `8e43f929-0f3d-4033-b360-0f62108cca6f`。1440²/60fps/5s。
- **为什么两跳**: 5s 源帧总数有限, 三跳时帧分三份→第三跳源帧太稀+顶点出现冻结帧=卡顿(用户否)。改两跳→每跳帧更密、峰值帧间差 19.5→15.5、无冻结。
- 抽帧: `extract-frames-bodynorm.py <mp4> lemmy-rabbit-front-canonical.png <out> celebrate 110 0.02 0.99 0.70 131 1`(uniform_torso=131 统一缩放=idle/headshake 同基准 + 末位 `1`=jump_mode 保腾空、按源地面线锚定)。
- **后处理两步(治卡顿, 关键)**: ① 贪心去重 in-place, 相邻(对上一保留帧)平均像素差 **<3.0** 丢弃(即梦源有效帧率低→精确重复帧+顶点微停, 阈值 2.0 漏网了 2.2 的顶点冻结帧, 提到 3.0 才清干净); ② **砍静止长尾**: 找最后一个腾空帧(脚底≤484)其后留 3 帧站定截断(frames2video 强制尾帧=高站立定妆图→落地后又"长高"snap+一长串静止站立帧=回平静时像冻住)。最终 **93 帧**, 相邻差 min 3.18/中位 6.71/max 15.47、0 冻结、头顶 53 不触顶、离地 58px、躯干 131 同屏宽。trimType none meta 按 idle 模板逐帧新 uuid。
- 产物: `assets/resources/art/characters/lemmy/celebrate/`(93 帧; 未接进运行时; 通关/修复完成播一遍→接 idle)。
- 备选源 `lemmy-celebrate-3jump-alt-source.mp4`(submit_id `004a5a7d-d9d4-4600-9a38-fe4151b58c63`): 初版三跳、**张嘴**欢呼、耳朵带抖动。被两跳闭嘴版取代, 留作可重抽备选。(中间还有个三跳闭嘴版 submit_id `de1b07c7-ae19-4842-8d2d-77b0f1eadcf9` 也被弃, 要找回用 `dreamina query_result --submit_id=` 重下。)

## turnface(2026-07-11 定稿, 侧脸→正脸转头过渡 — 补 reach(侧)→headshake(正)原本的硬切)
- `lemmy-turnface-source.mp4`: frames2video 首帧=正脸定妆(`lemmy-rabbit-front-canonical` 白底) / 尾帧=**新侧脸定妆**(`assets/art/style-references/lemmy-rabbit-side-canonical.webp` 白底, 用户 2026-07-11 提供)。正面看镜头→转头变侧面, 身体站立不动。1080p/5s。submit_id `8df19c79-cb0c-4d3e-aeb0-5bf645f65255`。
- **为什么这次成了(之前放弃过)**: headshake 那节记的"转脸方案已放弃"是因旧 v9 平面正脸 vs 立体侧脸几何不自洽→即梦转头中段生鬼眼。这次用户给的**新侧脸定妆几何自洽**, 中段 3/4 帧眼睛干净无鬼眼, 转头过渡可用。
- 抽帧: `extract-frames-arc.py <mp4> ref-front.png <out> turn 24 0.10 0.95`(统一缩放+脚底锁) → **反向排列**(侧→正)为 turnface-00..23。再按躯干宽 125/脚底 490 逐帧统一缩放归一(源正面帧比侧面小 ~3% 单调漂移, 平滑缩放曲线 1.003→1.030 校正), 锁恒定身体大小。
- 产物: `assets/resources/art/characters/lemmy/turnface/`(24 帧)。contract fps 30(≈0.8s); 接在 reach 与 headshake 之间(`M01IntroSequence.beginBasketReachMiss`)。

## puzzled(2026-07-11 定稿, 困惑不解反应 — 正脸原地微微歪头→回正)
- `lemmy-puzzled-source.mp4`: frames2video 首尾双锁【正脸定妆】(`lemmy-rabbit-front-canonical` 白底), 正面原地微微歪头看向一侧(好奇/不解手势)→摆正回正视。1080p/5s。submit_id `71eb496b-d9a4-452b-aba9-8646e86c0e63`。
- 抽帧: `extract-frames-arc.py <mp4> ref-front.png <out> puzzled 30 0.08 0.95`(统一缩放+脚底锁) → 再按躯干宽 125/脚底 490 逐帧统一缩放归一(平滑缩放 0.992→1.014)锁恒定身体大小。正脸全程橙, 无鬼眼。
- 产物: `assets/resources/art/characters/lemmy/puzzled/`(30 帧)。contract fps 14(≈2.1s, hold-last)。**未接进具体 beat**, 需要时 `playFrameAction("puzzled")`。

## nod(2026-07-11 重做, 点头 — 正脸低头→回正; 取代 headshake 首版残留的旧 nod)
- `lemmy-nod-source.mp4`: frames2video 首尾双锁【正脸定妆】(`lemmy-rabbit-front-canonical` 白底), 正面原地微微低头看向地面→抬脸回正。1080p/5s。submit_id `4ec1d057-ee18-42ea-b99c-1e8cc6a9f369`。
- 抽帧: `extract-frames-arc.py <mp4> ref-front.png <out> nod 24 0.08 0.95` → 躯干宽 125/脚底 490 逐帧统一缩放归一(躯干全程 123-125 稳, 头点下去身高 429→414→429 是真实竖直点头, 保留)。正脸全程橙, 无鬼眼。
- 产物: `assets/resources/art/characters/lemmy/nod/`(24 帧, 覆盖旧 27 帧)。contract fps 14(≈1.7s, hold-last)。**未接进具体 beat**。
- 旧 nod(headshake 首版意外出成点头, v9 正脸源)已被本版替换; 要找回见 git 历史。

## crouchback(2026-07-15, 耳后贴⑦收耳版蹲下拾取 — 补篮下收耳时播竖耳 crouch 的穿帮)
- `lemmy-crouchback-source.mp4`: frames2video 首尾双锁【耳后贴锚图】(`lemmy-firstframe-earsback-pencil-white.png`, pencil 已烘→跳描边脚本), prompt=收耳状态缓缓蹲下、一只前爪伸向地面轻触、收爪起身回站姿;明确"两耳全程后贴不竖起"+"画面无任何其他物体"(防即梦画出道具)。1440²/60fps/5s。submit_id `7b6a98ce-57aa-4e18-a79c-81eed6031d76`。
- 抽帧: `extract-frames-arc.py <mp4> lemmy-rabbit-canonical-pencil.png <out> crouchback 40 0.0 0.55`(源弧对称 站429→蹲底275→回429, **只取下蹲段** seg 0-0.55 与 crouch 语义一致, 起身=运行时反播)。
- 收耳族对齐: arc 输出站姿躯干 180 → 全帧统一缩放 k=131/180(脚底钉 490、水平对齐 idleback footcx 250.8), 校后站姿 躯干131/脚底490/totH314 与 idleback-00(131/490/314) 完全一致。
- 去重: 即梦低有效帧率带进的近重复帧按相邻 diff<2.0 贪心剔除, 40→**28 帧**, 相邻差 min2.07/med3.28/max4.54 无卡帧。oxipng -o4。
- 产物: `assets/resources/art/characters/lemmy/crouchback/`(28 帧)。contract fps 35(≈0.8s, hold-last)。**已注册未接 beat**: `M01IntroSequence.beginPickup` 仍固定播竖耳 `crouch`, 收耳时(earsFolded)应改播 crouchback——待接线。

## nodside(2026-07-11, 侧面点头 — 旧 nod 存作侧面变体)
- 无独立源视频: 即是 headshake 第一版意外出成的【侧3/4脸点头】27帧(v9 之前的侧脸源, 见 headshake 节缘由链), 2026-07-11 nod 改为正面点头后把旧帧存作 `nodside`(侧面点头变体)。
- 产物: `assets/resources/art/characters/lemmy/nodside/`(27 帧, 由旧 `nod/` 迁入)。contract fps 14, hold-last。**未接进具体 beat**。
