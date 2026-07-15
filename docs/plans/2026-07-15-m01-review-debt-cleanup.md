# M01 Review Debt Cleanup Implementation Plan

**Status (2026-07-15):** Implemented and verified on `codex/m01-review-debt`. The initial `headbutt`
prefix fallback was superseded later the same day by the approved dedicated 28-frame `crouchback`
clip. Gear sizing and 1.65 saturation remain deliberately out of scope.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the remaining M01 review debt without changing the deferred gear sizing or flashlight saturation decisions.

**Architecture:** Keep gameplay decisions in the engine-independent M01 layer and use Unity only for playback and GameObject verification. Use the authored `crouchback` action for basket-zone ground pickup and reverse the same clip for rising, so ears remain folded throughout without borrowing frames from the semantically different headbutt. Remove editor/reference-only and legacy-unused images from Unity `Resources`; replace source-text assertions with pure behavior tests, parsed configuration checks, or the existing Unity Editor verifier.

**Tech Stack:** Unity 6.3/C# 9, xUnit/net10, Unity batchmode Editor verification, Vitest/TypeScript historical parity.

---

### Task 1: Folded-ear ground pickup

**Files:**
- Modify: `StarGuardian/Assets/Scripts/M01/M01IntroFlow.cs`
- Modify: `StarGuardian/Assets/Scripts/M01/Rendering/M01LemmyPlayback.cs`
- Modify: `StarGuardian/Assets/GlowProbe/M01LemmyAnimator.cs`
- Modify: `StarGuardian/Assets/GlowProbe/M01IntroProbe.cs`
- Modify: `StarGuardian/Assets/Editor/M01InteractionGlueVerifier.cs`
- Test: `unity-tests/Core.Tests/M01IntroFlowTests.cs`
- Test: `unity-tests/Core.Tests/M01/M01LemmyPlaybackTests.cs`

1. Add failing tests that choose folded crouch for a ground pickup in the ear-fold zone and map that decision to the authored `crouchback` action.
2. Run the targeted xUnit tests and confirm they fail because the dedicated action is not registered or available in Unity.
3. Register the 28-frame/35fps action in the Unity render contract and mirror its approved PNGs into Unity `Resources`.
4. Route basket-zone crouch pickup through `crouchback`/reverse; keep normal `crouch` outside the zone and remove the temporary frame-range playback API.
5. Extend `M01InteractionGlueVerifier` to assert the actual first Unity sprite is `crouchback-00` forward and `crouchback-27` reverse.
6. Run targeted xUnit and Unity batchmode verification.

### Task 2: Runtime resource hygiene

**Files:**
- Move: `StarGuardian/Assets/Resources/Configs/m01-render-source-manifest.json` → `production/manifests/m01-render-source-manifest.json`
- Delete: `StarGuardian/Assets/Resources/Configs/m01-render-source-manifest.json.meta`
- Delete: `StarGuardian/Assets/Resources/Art/M01/lemmy-canonical.png{,.meta}`
- Delete: `StarGuardian/Assets/Resources/Art/M01/m01-fragment-floor-surface.png{,.meta}`
- Delete: four `StarGuardian/Assets/Resources/Art/M01/m01-evidence-*.png{,.meta}` pairs
- Delete: three `StarGuardian/Assets/Resources/Art/M01/m01-filter-*.png{,.meta}` pairs
- Modify: `unity-tests/Core.Tests/M01/M01RenderAssetManifestTests.cs`
- Modify: `docs/plans/2026-07-13-m01-cocos-unity-render-parity.md`
- Modify: `production/active.md`

1. Add a failing resource-boundary test asserting these reference/legacy assets are absent from Unity `Resources` and the frozen manifest has no absolute development-machine path.
2. Verify the test fails against the current tree.
3. Move the frozen manifest outside `Assets`, remove `sourceRepository`, delete the unused Unity runtime copies, and remove dead “must exist” inputs from the old asset contract.
4. Update manifest references in docs and rerun the asset tests.

### Task 3: Replace source-text glue tests

**Files:**
- Delete: `unity-tests/Core.Tests/M01UnityGlueParityTests.cs`
- Create: `StarGuardian/Assets/Scripts/M01/M01CandidateAssembly.cs`
- Create: `unity-tests/Core.Tests/M01CandidateAssemblyTests.cs`
- Create: `unity-tests/Core.Tests/M01TestArchitectureTests.cs`
- Create: `unity-tests/Core.Tests/M01UnityProjectSettingsTests.cs`
- Modify: relevant existing pure M01 test files only where a behavior is not already covered
- Modify: `StarGuardian/Assets/Editor/M01InteractionGlueVerifier.cs`

1. Inventory each source-reading test and map it to existing behavior coverage, a new pure behavior test, an actual Unity Editor assertion, a parsed project-setting rule, or deletion as duplicate/implementation-coupled.
2. Add any missing behavior/config/Unity assertions before removing their source-text predecessor; run each targeted test to establish RED where new production support is required.
3. Delete `M01UnityGlueParityTests.cs` once every useful contract has a non-source-text home or is explicitly judged redundant.
4. Assert the test tree no longer contains `ReadRepoFile`-based production-source checks.

**Migration result:** the fixed timestep is now parsed from `TimeManager.asset`; pickup facing,
full-platform validation, and live-occupant evidence composition are pure behavior tests; folded
pickup frames, nested sorting, and parked-body state run through the Unity Editor verifier. Existing
layout, visual-parity, session, placement-ledger, importer-metadata, and clip-cache tests retain their
own contracts. The remaining implementation-name/order assertions were deleted because they did not
execute Unity GameObjects, physics, or coroutines and therefore did not constitute runtime coverage.

### Task 4: Final verification and review

**Files:**
- Modify: `production/active.md`

1. Run full xUnit, Vitest, TypeScript typecheck, Unity batchmode compilation/Editor verifier, `git diff --check`, and dependency/security scans.
2. Review the complete diff for accidental removal of runtime-consumed assets and for test-coverage regressions.
3. Record exact evidence in `production/active.md`.
4. Commit only the scoped files on `codex/m01-review-debt`.

**Explicitly out of scope:** gear `CONTAIN` versus `CUSTOM`; observed-fragment saturation `1.4` versus `1.65`; all changes from unmerged `2511bac` not independently selected above.
