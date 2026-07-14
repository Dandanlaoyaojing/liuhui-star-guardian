# M01 Unity 视觉与篮内物理等价实施计划

## 目标

把 Unity M01 当前仍偏离 Cocos 的四处表现收回到同一真源：篮内九片结算方法、纸底/平台/篮子色彩路径、手电三色光束、拼片受光后的反应色。

## 已确认根因

- Cocos 的九片在 `Settling` 和 `Headbutting` 阶段始终是篮子子节点，释放时才改挂场景根；Unity 当前在启用 Dynamic 后立即改挂根节点，篮子与内胆继续被绳子移动，局部物理参考系因此不同。
- 平台与篮子 PNG 哈希一致；Unity 平台使用 `Sprite-Lit-Default + Global Light2D`，篮子使用默认 Sprite 材质，二者不在同一颜色管线。
- Cocos 纸底是 `(247,244,235)`，Unity 当前是 `(237,232,219)`。
- Cocos 用方向性渐变三角光锥、白热灯芯和独立的高饱和显色算法；Unity 当前用 Point Light2D，并用一组低饱和手写颜色，光会进一步把色相冲白。

## 实施

1. 新增引擎无关的 `M01VisualParity`，逐字迁移 Cocos 的纸底、光束视觉 RGB、显色 RGB、通道相乘和 1.4 倍饱和算法，并用 xUnit 锁定字节值。
2. 让 `M01BoardProbe` 的纸底使用精确 Color32；去掉平台/拼片专属的 Lit 材质与全局灯，使水彩平台和篮子统一走默认不受光 Sprite 路径。
3. 让 `M01FlashlightProbe` 用运行时生成的 Cocos 同构锥形渐变纹理和径向灯芯；光锥置于平台上、拼片下，拼片反应色直接消费 `M01VisualParity`。
4. 把大头光晕恢复为 Cocos 的局部 Y=11px、直径 18px、alpha=210。
5. `M01IntroProbe` 在篮内结算/顶动时保留篮子父节点，只在真正释放的批次改挂场景根；继续保留 Dynamic Rigidbody2D、同一碰撞体、重力、阻尼、摩擦与 1/60 固定步长。
6. 用 Cocos/Unity 固定时刻截图和九片局部坐标诊断复核，不硬编码某次物理解算结果。

## 验证

- 先跑新增聚焦测试并确认红，再实现到绿。
- 跑完整 xUnit、Unity C# build、`git diff --check`。
- Unity Play 中核对篮内堆叠、平台/篮子相对色、红黄蓝光锥与六种拼片反应色。
- 最后执行依赖与源码安全检查；不提交、不覆盖工作区内其他既有改动。
