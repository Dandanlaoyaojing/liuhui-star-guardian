# M01 Unity Fragment Interaction Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use test-driven-development and verification-before-completion task by task.

**Goal:** Make Unity reproduce the final Cocos fragment pickup/rotate/drop physics and the three-pieces-per-headbutt basket behavior.

**Architecture:** Keep the existing Unity probes and port only the missing runtime glue. Put gesture and intro-gating decisions in engine-independent C# rules covered by xUnit; let `M01DragProbe` own pointer/body transitions and let `M01IntroProbe` report which released fragments are truly outside the moving basket.

**Tech Stack:** Unity 6, C# 9 runtime scripts, .NET 10 xUnit parity tests, Physics2D.

---

### Task 1: Lock Cocos pointer and basket contracts

**Files:**
- Create: `unity-tests/Core.Tests/M01FragmentPointerRulesTests.cs`
- Modify: `unity-tests/Core.Tests/M01IntroLayoutTests.cs`
- Create: `StarGuardian/Assets/Scripts/M01/M01FragmentPointerRules.cs`
- Modify: `StarGuardian/Assets/Scripts/M01/M01IntroLayout.cs`

1. Add failing tests for the inclusive 6px tap threshold, 90-degree rebaseline/rotation, two-second pin, pre-settle spilled-fragment pickup gate, and first-hit cavity removal.
2. Run the focused tests and confirm they fail because the parity rules do not exist.
3. Add the smallest pure implementations.
4. Re-run the focused tests and confirm they pass.

### Task 2: Port the Cocos runtime pointer/body transitions

**Files:**
- Modify: `StarGuardian/Assets/GlowProbe/M01DragProbe.cs`
- Modify: `StarGuardian/Assets/GlowProbe/M01FlashlightProbe.cs`

1. Hit-test visible GameObject positions instead of stale layout positions.
2. Preserve the grab offset and use the visual center for release.
3. On pickup, cancel any rotate pin, rebaseline only the rotation ledger, and disable body/colliders while pointer-controlled.
4. On a <=6px release, rotate 90 degrees, preserve the collider's lowest Y, park kinematically for two seconds, then resolve the drop.
5. On a drag release, resolve snap/stick/free and restore the matching Kinematic/Dynamic physics state.
6. Turn off flashlight observation only after an actual fragment pickup.

### Task 3: Port the Cocos intro pickup and headbutt gates

**Files:**
- Modify: `StarGuardian/Assets/GlowProbe/M01IntroProbe.cs`
- Modify: `production/active.md`

1. Keep unreleased/in-basket fragments unpickable while allowing a released fragment once it exits the basket's current AABB.
2. Mark global physics settled after the final pile settles and synchronize every token position from its landed GameObject.
3. Remove the basket cavity on the first headbutt before applying the three-piece release impulse.
4. Keep unreleased pieces frozen as basket children so the rope/basket jolt moves the whole remaining pile, matching Cocos.
5. Prevent intro ground walking when the pointer actually targets a pickable fragment.

### Task 4: Verify

1. Run focused xUnit tests.
2. Run the complete `dotnet test` suite.
3. Build Unity `Assembly-CSharp.csproj` with zero errors.
4. Run Cocos scaffold parity tests.
5. Inspect the final diff for unrelated files and security-sensitive behavior.

### Task 5: Close review parity gaps

1. Keep the final ground pile in Dynamic simulated physics and sleep it instead of removing it from Physics2D; wake remaining pieces when a support is picked up.
2. Route mouse and iOS touch through the Input System's unified pointer path.
3. Give fragment pickup priority over the held flashlight, then cycle the held flashlight when its visible body is tapped.
4. Re-run all verification after these review fixes.

The worktree already contains substantial user changes, so this plan intentionally does not stage or commit files.
