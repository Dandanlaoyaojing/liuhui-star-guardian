# Unity M01 Engine-Parity Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use systematic-debugging and test-driven-development task-by-task.

**Goal:** Eliminate remaining Cocos-to-Unity unit mismatches; restore invariant base colors, flashlight observation colors, live structure-validation colors, and a visible native-aspect flashlight.

**Architecture:** Keep Cocos pixel-space gameplay values as the source of truth. Convert only at Unity engine boundaries through `M01IntroLayout`, and keep interaction state separate from `SpriteRenderer.color`. The flashlight state remains the existing pure `off → red → yellow → blue → off` model; Unity adds only the missing head-glow presentation.

**Tech Stack:** Unity 6.3 LTS Physics2D/URP 2D, C# 9, xUnit net10, existing Cocos TypeScript reference.

---

### Task 1: Lock the cross-engine unit contract

**Files:**
- Modify: `unity-tests/Core.Tests/M01IntroLayoutTests.cs`
- Modify: `StarGuardian/Assets/Scripts/M01/M01IntroLayout.cs`
- Modify: `StarGuardian/ProjectSettings/TimeManager.asset`

1. Add failing tests for PTM32 velocity, radians-to-degrees, density/area scaling, the 1/60 fixed physics step, and the Cocos flashlight visual/collider/hit sizes.
2. Run the focused tests and confirm each fails for the missing or wrong value.
3. Add the smallest conversion constants/functions and set Unity Physics2D to the Cocos 1/60 step.
4. Run the focused tests again.

### Task 2: Remove interaction-driven fragment recoloring

**Files:**
- Create: `unity-tests/Core.Tests/M01UnityGlueParityTests.cs`
- Modify: `StarGuardian/Assets/GlowProbe/M01DragProbe.cs`
- Modify: `StarGuardian/Assets/GlowProbe/M01BoardProbe.cs`

1. Add a source-contract regression test proving drop, weak-snap, target-snap, and free placement never write a new fragment base tint.
2. Confirm the test fails on the current `feedback` color switch.
3. Remove the probe-only feedback tint and retain only sorting, transform, session, and physics changes.
4. Keep `FragmentBaseColors` immutable at the original `Color.white`, so flashlight reveal always restores the original watercolor/alpha.

### Task 3: Restore flashlight size and three-color head feedback

**Files:**
- Modify: `unity-tests/Core.Tests/M01IntroLayoutTests.cs`
- Modify: `unity-tests/Core.Tests/M01UnityGlueParityTests.cs`
- Modify: `StarGuardian/Assets/GlowProbe/M01IntroProbe.cs`
- Modify: `StarGuardian/Assets/GlowProbe/M01FlashlightProbe.cs`

1. Add failing tests for a compact native-aspect `18×40px` visual, independent `14×30px` collider, `44px` hit target, and use of the pure four-state cycle.
2. Confirm the current `50×128px` display and shared display/collider size fail.
3. Size the art and collider independently; use the current 198×437 art ratio so it no longer looks stretched thin.
4. Replace the private index-only presentation with the existing pure `M01FlashlightObservation.CycleLight` state and map it to the three configured flashlight IDs.
5. Add a child head glow at local `(0, 15px)` with the Cocos red/yellow/blue visual palette; leave the flashlight body white/original.
6. Verify red, yellow, blue, and off by repeated clicks in Unity Play mode.

### Task 4: Restore flashlight settling and structure-validation presentation

**Files:**
- Modify: `unity-tests/Core.Tests/M01UnityGlueParityTests.cs`
- Modify: `StarGuardian/Assets/GlowProbe/M01IntroProbe.cs`
- Modify: `StarGuardian/Assets/GlowProbe/M01DragProbe.cs`
- Modify: `StarGuardian/Assets/GlowProbe/M01BoardProbe.cs`

1. Add failing contracts for visible flashlight settling, wrong-angle full-platform validation, fragment validation colors, and geometric overlap reaction colors.
2. On settle, synchronize both Rigidbody2D and Transform, disable interpolation, and recover to a readable foot-side location when the physics result is hidden/offscreen.
3. Track target-slot occupancy separately from correct staging so a full platform containing a wrong-angle `stick_fragment_to_slot` piece still validates immediately.
4. Render Session `validationColor` on candidate fragments and recompute actual overlap polygons via `M01StandardPieceBlend.ResolveOverlays` for both correct and incorrect structures.
5. Preserve the configured three-second failure reveal, then restore base colors and return the failed candidate pieces to physics.

### Task 5: Audit and verify every migrated M01 unit boundary

**Files:**
- Modify: `production/active.md`

1. Scan all M01 non-zero `Rigidbody2D` velocities, angular velocities, gravity, collider dimensions/density, fixed-step values, time conversions, positions, radii, and rotations.
2. Confirm every engine-boundary value uses the centralized conversion or is dimensionless/already in seconds/degrees.
3. Run focused tests, full xUnit, Unity build, Cocos scaffold, diff checks, dependency audit, and targeted secret/dangerous-API scans.
4. Re-run the exact mouse interactions in Unity and leave the corrected preview open.

No commit is created from this dirty shared worktree unless the user explicitly asks for one.
