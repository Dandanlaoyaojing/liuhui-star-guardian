# 星光棒(M02 魔杖) 暗/亮双态素材

2026-07-18 生成。源头 = 用户提供的两张裂纹星星图(`stills/star-ref-{dark,lit}.png`)，
经即梦(dreamina CLI)配杆成魔杖、再生成微闪循环视频、抽帧成精灵帧。

## 管线与参数(可复现)

1. **配杆(image2image, model 5.0, 2:3, 2k)**
   - 暗态 `stills/wand-dark.png` ← star-ref-dark, submit_id `df5fabe7-d550-43e4-8c6d-b4801f44afec`
   - 亮态候选:
     - `wand-lit-rays.png`(暖木杆, 与暗态**不同杆**, 只作特写/宣传) `61fd18b1-41a5-4f6d-9dd0-88e0da165711`
     - `wand-lit-cracks.png`(同杆, 缝隙漏光, 可作点亮过程中间态) `baup69g1a 批次`
     - **`wand-lit-red.png`(定稿亮态: 同杆+左半复活红, 双参考生成)** `bq4pxhmhe 批次`
   - 教训: CLI 省略 `--resolution_type` 会对 5.0 传非法默认值报 `invalid param`, 必须显式 `--resolution_type=2k`。
2. **微闪循环视频(frames2video, seedance2.0_vip, 1080p, 5s, 首尾锁同图)**
   - `source-videos/twinkle-dark.mp4` submit_id `05aecb10-8149-4597-bc28-6178479811c2`(裂缝残光明灭)
   - `source-videos/twinkle-lit.mp4` submit_id `f4807232-3752-4b97-9219-9c3862d66061`(光晕呼吸+光丝闪烁)
   - 两段皆 60fps/302 帧, 杖体逐帧静止(杖心 x 波动 0.1px)。
3. **抽帧(`frames/{dark,lit}/`, 各 24 帧 245×512)**
   - 循环开区间采样 `round(i*302/24)`(尾帧≠首帧, 防循环卡帧); 建议播放 24 帧/5s ≈ 4.8fps 循环。
   - 白底转 alpha: 本体掩膜(轮廓最大连通域+填洞, 防星身漏光被抠穿)强制不透明; 背景=跨帧最小 minc≥228 的边框连通域强制透明(防纸纹鬼影); 其余按白度软渐变(光晕半透明烘焙)。
   - 两态已对齐(亮态平移 dx=6,dy=21 入暗态坐标): 成品星尖 y 相差 0px、杖心 x 相差 0.3px, **可原位状态切换**。

## 星星熄灭过程(dimdown, 2026-07-18 追加)

- **源**: `star-ref-dark.png`(带暖光斑的裂纹星) → image2video(seedance2.0_vip, 1080p, 5s), submit_id `b3f42a2b-3deb-41a2-a0f2-c11c4086ec74`。
- **裁切**: 原片 `star-dimdown.mp4`(5s) 尾段约 3.4s 起**风格漂移**(水彩纹理/墨线被抹平成哑光粘土星)——即梦"渐变到目标状态"类单图生视频的通病, 目标状态总在前段提前达成, **裁尾即可不必重生成**。定稿 `star-dimdown-trim.mp4`(3.2s): 光斑逐一熄灭→彻底暗透, 纹理全程保留, 镜头零动、星形 bbox 首末差≤3px。
- **帧**: `frames/dimdown/` 24 帧 535×512, **弧线闭区间采样**(首尾姿态都保留, 区别于循环开区间), 3.2s 铺满 ≈7.5fps; 抠图同主管线(末帧本体掩膜全程通用+跨帧背景泛洪)。首末帧覆盖率同为 38.8%(几何静止)。
- **用途**: 通用"星星暗淡/被雾侵蚀熄灭"演出素材, 具体消费点(M02 主盘/序章/星图)待指派。

## 使用注意

- 帧为 straight-alpha、光晕已烘焙。若在深底场景显灰, 升级路径: 拆"本体(不透明)+光晕(additive)"双层, 或只用本体帧、光晕交给 Unity Light2D/Bloom(M02 现管线)。
- 尚未接入 Unity 运行时(接入前**不要**拷进 `StarGuardian/Assets/Resources/`, 死资产不进包)。
- 源视频是唯一可重抽源; 删了可用 submit_id 经 `dreamina query_result` 重下。
