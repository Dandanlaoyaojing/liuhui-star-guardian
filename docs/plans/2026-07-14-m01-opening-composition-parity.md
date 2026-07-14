# M01 Opening Composition Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use systematic-debugging and test-driven-development task-by-task.

## Goal

让 Unity 的 M01 静态开场与当前 Cocos 运行真值使用同一套可见节点、颜色和篮内九片最终姿态，同时保留 Unity 中已经补齐的真实 Physics2D 顶篮、释放与落地堆叠。

## Root-cause contract

- 篮子源图、显示尺寸、锚点和位置已经逐项与 Cocos 相等；不改篮子缩放，避免用低分辨率截图的插值误差反向污染正确参数。
- Cocos 当前开场的 `referencePattern` 根节点存在但透明；Unity 不应额外绘制手写的完整参考图案。
- Cocos 齿轮 Sprite 源真值为白色、alpha 210；Unity 项目为保留 URP 2D/Bloom 使用 Linear，和 Cocos 近 Gamma 的半透明混合/缩采样不同。直接照搬 210 会让齿轮偏浅，必须使用局部的 Unity Linear 补偿，不能切换全局色彩空间。
- 两边虽然都是 Box2D，但引擎版本和求解器细节不同，九片从相同种子点自然沉降后仍会得到不同静止姿态。Cocos 连续三次预览的结果稳定，因此在 0.9 秒沉降冻结边界应用 Cocos 的确定性局部姿态；之后顶篮时仍恢复 Dynamic Physics2D。

## Implementation

1. 先补回归测试，锁定开场不绘制透明参考图、Cocos 齿轮源 alpha 210、Unity Linear 局部补偿，以及九片 Cocos 稳定姿态的 id/坐标/角度。
2. 在 `M01VisualParity` 分开保存 Cocos 源真值与逐像素标定的 Unity Linear 齿轮/篮子 tint，并让渲染胶水明确消费对应值。
3. 删除开场对 `RenderReferencePattern` 的调用；保留布局数据，避免影响谜题逻辑。
4. 在 `M01IntroLayout` 增加按 fragment id 查询的 Cocos settled pose 契约。
5. 在 `FreezeBasketPileAfterDelay` 的既有 0.9 秒边界先应用该局部姿态，再切换 Frozen；释放与顶篮路径不变。
6. 跑聚焦测试、完整测试和 Unity 编译/Play，确认 Console 无错误。
7. 用 Unity 超采样相机重新截图，复用既有 Cocos 开场截图生成同尺寸并排对比，避免上一版低分辨率 Unity 截图被放大造成的颜色/尺寸错觉。

## Verification

- `dotnet test unity-tests/Core.Tests/Core.Tests.csproj --no-restore --filter "M01VisualParityTests|M01IntroLayoutTests|M01UnityGlueParityTests"`
- `dotnet test unity-tests/Core.Tests/Core.Tests.csproj --no-restore`
- Unity Play：左上角无参考图；篮内九片姿态贴近 Cocos；顶篮后仍有真实上扬和碰撞。
- Unity Console：0 error。
- `git diff --check`，并做本轮改动的安全检查。
