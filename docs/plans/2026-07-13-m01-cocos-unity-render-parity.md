# M01 Cocos → Unity Render Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the complete M01 Cocos rendering layer to Unity 6.3 LTS with automated proof that display sizes, token poses, anchors, trim compensation, layers, assets, and frame sequences remain equivalent.

**Architecture:** Freeze Cocos rendering behavior into a Unity-independent C# contract, test it first, and route production Unity renderers through one coordinate/sprite-aspect compatibility layer. Keep current probe components as temporary scene adapters until each production renderer passes contract and Unity batch-mode verification.

**Tech Stack:** Cocos Creator 3.8 TypeScript source, Unity 6.3 LTS 2D URP, C# 9, xUnit/net10 parity tests, Unity BatchMode, PNG/MP4 resource hash checks.

---

### Task 1: Freeze the source snapshot and render contract

**Files:**
- Create: `StarGuardian/Assets/Scripts/M01/Rendering/M01RenderContract.cs`
- Create: `unity-tests/Core.Tests/M01/M01RenderContractTests.cs`
- Create: `StarGuardian/Assets/Resources/Configs/m01-render-source-manifest.json`
- Modify: `production/active.md`

**Steps:**
1. Write failing tests for design size, PPU, gear/basket/ground/hint display sizes, asset paths, sorting roles, 18 Lemmy actions and 697 total frames.
2. Run `dotnet test unity-tests/Core.Tests/Core.Tests.csproj --no-restore --filter M01RenderContractTests` and confirm failures are caused by the missing contract.
3. Implement only the pure C# contract required by the tests.
4. Generate the source manifest with SHA-256 values for the selected Cocos code/config/resource files.
5. Re-run the targeted tests and then the full xUnit suite.

### Task 2: Port sprite aspect and coordinate semantics

**Files:**
- Create: `StarGuardian/Assets/GlowProbe/M01CocosTransform.cs`
- Create: `StarGuardian/Assets/GlowProbe/M01SpriteAspect.cs`
- Create: `unity-tests/Core.Tests/M01/M01RenderGeometryTests.cs`

**Steps:**
1. Write failing pure geometry tests for px/world conversion, clockwise rotation, pivot offset, trimmed sprite offset and contain/cover/width/height fitting.
2. Confirm the tests fail before production implementation.
3. Implement pure calculations in the rendering contract namespace and a thin UnityEngine application layer.
4. Verify targeted and full xUnit tests.

### Task 3: Synchronize exact M01 assets

**Files:**
- Modify: `StarGuardian/Assets/Resources/Art/M01/**`
- Create: `unity-tests/Core.Tests/M01/M01RenderAssetManifestTests.cs`

**Steps:**
1. Write a failing resource-manifest test expecting all Cocos runtime M01 sprites, 18 Lemmy actions/697 PNGs, current completion MP4/audio, and exact hashes.
2. Confirm the current Unity set fails (notably 303/697 Lemmy frames).
3. Mechanically copy binary resources from the frozen Cocos snapshot into Unity without modifying source assets.
4. Configure importer defaults through an Editor script where Unity metadata must be deterministic.
5. Verify counts, hashes, image dimensions and full xUnit suite.

### Task 4: Port Lemmy rendering exactly

**Files:**
- Modify: `StarGuardian/Assets/GlowProbe/M01LemmyAnimator.cs`
- Create: `StarGuardian/Assets/GlowProbe/M01LemmyRenderer.cs`
- Create: `unity-tests/Core.Tests/M01/M01LemmyRenderContractTests.cs`

**Steps:**
1. Write failing tests for action paths, FPS, loop behavior, foot-anchor fraction, displaySize, renderScale and facing transformation.
2. Implement the pure pose/frame calculations.
3. Make the Unity renderer consume those calculations and preserve frame ordering.
4. Verify 18 actions load and 697 frames are addressable in Unity BatchMode.

### Task 5: Port static board and fragment rendering

**Files:**
- Create: `StarGuardian/Assets/GlowProbe/M01BoardRenderer.cs`
- Create: `StarGuardian/Assets/GlowProbe/M01FragmentRenderer.cs`
- Modify: `StarGuardian/Assets/GlowProbe/M01BoardProbe.cs`
- Create: `unity-tests/Core.Tests/M01/M01BoardRenderContractTests.cs`

**Steps:**
1. Write failing tests that feed the real M01 layout and assert every rendered item pose, display size, rotation and sorting role.
2. Implement board/surface/gear/slot/evidence/fragment render DTO generation.
3. Implement SpriteRenderer consumers using only `M01CocosTransform` and `M01SpriteAspect`.
4. Retain procedural fallbacks only behind an explicit debug switch.
5. Verify tests and Unity compilation.

### Task 6: Port flashlight, hint and validation rendering

**Files:**
- Create: `StarGuardian/Assets/GlowProbe/M01FlashlightRenderer.cs`
- Create: `StarGuardian/Assets/GlowProbe/M01HintRenderer.cs`
- Modify: `StarGuardian/Assets/GlowProbe/M01DragProbe.cs`
- Create: `unity-tests/Core.Tests/M01/M01FlashlightRenderContractTests.cs`

**Steps:**
1. Write failing tests for flashlight art variants, beam geometry, fragment state parameters, hint positions and validation-light states.
2. Port Cocos geometry/state decisions without changing thresholds.
3. Map shader uniforms to an equivalent URP material while preserving geometry output.
4. Verify targeted tests, full tests and Unity compilation.

### Task 7: Port the complete intro sequence

**Files:**
- Create: `StarGuardian/Assets/GlowProbe/M01IntroDirector.cs`
- Modify: `StarGuardian/Assets/GlowProbe/M01IntroProbe.cs`
- Create: `unity-tests/Core.Tests/M01/M01IntroRenderContractTests.cs`

**Steps:**
1. Write failing tests for basket/nail/rope/occluder poses, pile positions, release order, Lemmy waypoints, durations and action sequence.
2. Port the Cocos sequence method-by-method to Unity coroutines using the same state transitions and timing constants.
3. Apply the shared sprite-aspect and anchor layer to every actor.
4. Verify contract tests and Unity compilation.

### Task 8: Port completion and ToolCard rendering

**Files:**
- Create: `StarGuardian/Assets/GlowProbe/M01CompletionDirector.cs`
- Modify: `StarGuardian/Assets/GlowProbe/M01CompletionProbe.cs`
- Create: `unity-tests/Core.Tests/M01/M01CompletionRenderContractTests.cs`

**Steps:**
1. Write failing tests for celebration ordering, 960×640 overlay/video size, timing/watchdog/skip behavior and ToolCard geometry/text.
2. Implement Unity VideoPlayer plus the same fallback and teardown semantics required by the current Cocos config.
3. Port ToolCard layout and input locking.
4. Verify tests and Unity compilation.

### Task 9: Integrate, capture and compare

**Files:**
- Modify: `StarGuardian/Assets/Scenes/M01BoardProbe.unity`
- Create: `StarGuardian/Assets/Editor/M01RenderParityCapture.cs`
- Create: `docs/qa/m01-unity-render-parity.md`
- Modify: `production/active.md`

**Steps:**
1. Add deterministic capture states for initial board, each flashlight color, completed candidate, intro milestones, celebration and ToolCard.
2. Run Unity BatchMode compile/import/resource checks.
3. Capture Unity screenshots at 960×640 and compare against corresponding Cocos baselines.
4. Classify every difference as geometry, asset, animation timing or allowed URP overlay; fix all non-allowed differences.
5. Run the complete xUnit suite and Unity BatchMode verification again.
6. Update `production/active.md` with exact commands, pass counts, remaining visual exceptions (if any), and the frozen source manifest hash.
