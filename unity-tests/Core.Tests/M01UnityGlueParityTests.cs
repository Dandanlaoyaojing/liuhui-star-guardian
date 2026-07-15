using System;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Xunit;

namespace StarGuardian.Tests
{
    public sealed class M01UnityGlueParityTests
    {
        [Fact(DisplayName = "fragment pointer and snap glue never recolors the original watercolor sprite")]
        public void FragmentInteractionDoesNotWriteGameplayTint()
        {
            var source = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01DragProbe.cs");

            Assert.DoesNotContain("var feedback = action.Type switch", source);
            Assert.DoesNotContain("FragmentBaseColors[token.ControllerId] =", source);
            Assert.DoesNotContain("sr.color = feedback", source);
        }

        [Fact(DisplayName = "Unity Physics2D runs at the Cocos fixed step")]
        public void UsesCocosFixedPhysicsStep()
        {
            var settings = ReadRepoFile("StarGuardian/ProjectSettings/TimeManager.asset");

            Assert.Contains("Fixed Timestep: 0.016666667", settings);
        }

        [Fact(DisplayName = "flashlight art, collider, and touch target consume their independent Cocos contracts")]
        public void FlashlightUsesIndependentSizeContracts()
        {
            var intro = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01IntroProbe.cs");

            Assert.Contains("M01IntroLayout.FlashlightCanvasDisplaySize.Width", intro);
            Assert.Contains("M01IntroLayout.FlashlightCanvasDisplaySize.Height", intro);
            Assert.Contains("M01IntroLayout.FlashlightColliderSize.Width", intro);
            Assert.Contains("M01IntroLayout.FlashlightColliderSize.Height", intro);
            Assert.Contains("M01IntroLayout.FlashlightTapMinimumPixels", intro);
            Assert.Contains("CocosColliderDensityToUnity", intro);
        }

        [Fact(DisplayName = "Unity fragment art consumes the Cocos circle-only 60 by 60 display override")]
        public void FragmentArtUsesShapeSpecificDisplaySize()
        {
            var board = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01BoardProbe.cs");
            var start = board.IndexOf("private GameObject AddFragmentNode", StringComparison.Ordinal);
            var end = board.IndexOf("private bool TryAddArtSprite", start, StringComparison.Ordinal);
            Assert.True(start >= 0 && end > start);
            var fragmentBlock = board.Substring(start, end - start);

            Assert.Contains("M01GreyboxLayout.ResolveFragmentArtDisplaySize(frag.ShapeToken)", fragmentBlock);
            Assert.Contains("MakeArtSprite", fragmentBlock);
        }

        [Fact(DisplayName = "held flashlight uses the shared four-state cycle and renders a colored head glow")]
        public void HeldFlashlightShowsEveryCycleStateAtTheHead()
        {
            var source = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01FlashlightProbe.cs");

            Assert.Contains("M01FlashlightObservation.CycleLight", source);
            Assert.Contains("M01FlashlightHeadGlow", source);
            Assert.Contains("SetHeadGlow", source);
        }

        [Fact(DisplayName = "platform and basket art share the unlit Cocos sprite color path")]
        public void StaticWatercolorArtDoesNotUseUnityLightingAsAColorTransform()
        {
            var board = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01BoardProbe.cs");
            var intro = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01IntroProbe.cs");

            Assert.Contains("M01VisualParity.Paper", board);
            Assert.Contains("Sprite-Unlit-Default", board);
            Assert.Contains("renderer.sharedMaterial = board.ArtMaterial", intro);
            Assert.DoesNotContain("Sprite-Lit-Default", board);
            Assert.DoesNotContain("Light2D.LightType.Global", board);
        }

        [Fact(DisplayName = "flashlight uses the Cocos cone, core, and exact observed tint palette")]
        public void FlashlightUsesCocosDirectionalVisualsAndPalette()
        {
            var source = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01FlashlightProbe.cs");

            Assert.Contains("CreateConeGlowSprite", source);
            Assert.Contains("CreateRadialGlowSprite", source);
            Assert.Contains("M01VisualParity.BeamVisualColor", source);
            Assert.Contains("M01VisualParity.ObservedFragmentTint", source);
            Assert.Contains("sharedMaterial = board.ArtMaterial", source);
            Assert.DoesNotContain("Light2D.LightType.Point", source);
        }

        [Fact(DisplayName = "basket fragments remain in the basket coordinate system until release")]
        public void BasketPhysicsKeepsCocosParentingSemantics()
        {
            var intro = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01IntroProbe.cs");
            var start = intro.IndexOf("private void ApplyFragmentPhysics", StringComparison.Ordinal);
            var end = intro.IndexOf("private Collider2D EnsureFragmentCollider", start, StringComparison.Ordinal);
            Assert.True(start >= 0 && end > start);
            var physicsBlock = intro.Substring(start, end - start);

            Assert.Contains("fragment.transform.SetParent(basket.transform, true)", physicsBlock);
            Assert.DoesNotContain("fragment.transform.SetParent(sceneRoot.transform, true)", physicsBlock);
        }

        [Fact(DisplayName = "all non-zero Unity body velocities cross the Cocos unit conversion boundary")]
        public void NonZeroBodyVelocitiesUseCentralConversions()
        {
            var intro = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01IntroProbe.cs");
            var linearAssignments = Regex.Matches(
                    intro,
                    @"body\.linearVelocity\s*=\s*new Vector2\((?<value>[\s\S]*?)\);",
                    RegexOptions.CultureInvariant)
                .Cast<Match>()
                .Select(match => match.Groups["value"].Value)
                .ToArray();
            var angularAssignments = Regex.Matches(
                    intro,
                    @"body\.angularVelocity\s*=\s*(?<value>[^;]+);",
                    RegexOptions.CultureInvariant)
                .Cast<Match>()
                .Select(match => match.Groups["value"].Value.Trim())
                .Where(value => value != "0f")
                .ToArray();

            Assert.NotEmpty(linearAssignments);
            Assert.All(linearAssignments, value => Assert.Contains("CocosBodyLinearVelocityToUnity", value));
            Assert.NotEmpty(angularAssignments);
            Assert.All(angularAssignments, value => Assert.Contains("CocosBodyAngularVelocityToUnity", value));
        }

        [Fact(DisplayName = "flashlight remains a naturally simulated body after bonking instead of being teleported beside Lemmy")]
        public void FlashlightSettlesNaturallyAfterBonking()
        {
            var intro = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01IntroProbe.cs");
            var start = intro.IndexOf("private IEnumerator BeginFlashlightDrop()", StringComparison.Ordinal);
            var end = intro.IndexOf("private void ReleaseFlashlightToPhysics()", start, StringComparison.Ordinal);
            Assert.True(start >= 0 && end > start);
            var dropBlock = intro.Substring(start, end - start);

            Assert.DoesNotContain("ClampSettledFlashlightPosition", dropBlock);
            Assert.DoesNotContain("body.position =", dropBlock);
            Assert.DoesNotContain("body.rotation =", dropBlock);
            Assert.DoesNotContain("body.linearVelocity = Vector2.zero", dropBlock);
            Assert.DoesNotContain("body.angularVelocity = 0f", dropBlock);
            Assert.DoesNotContain("RigidbodyConstraints2D.FreezeRotation", dropBlock);
            Assert.DoesNotContain("body.Sleep()", dropBlock);
            Assert.Contains("Advance(M01IntroEvent.FlashlightBonked)", dropBlock);
        }

        [Fact(DisplayName = "flashlight pickup uses real fragment contact to choose standing or crouching pickup")]
        public void FlashlightPickupMotionUsesFragmentSupport()
        {
            var intro = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01IntroProbe.cs");

            Assert.Contains("IsFlashlightSupportedByFragment", intro);
            Assert.Contains("flashlightCollider.IsTouching(fragmentCollider)", intro);
            Assert.Contains(
                "M01IntroFlow.ResolvePickupMotion(IsFlashlightSupportedByFragment())",
                intro);
            Assert.Contains("pickupMotion == M01IntroPickupMotion.Crouch", intro);
            Assert.Contains("yield return PlayAction(\"crouch\")", intro);
        }

        [Fact(DisplayName = "Lemmy approaches the flashlight from his current side and faces it before pickup")]
        public void FlashlightPickupDoesNotWalkPastTheTool()
        {
            var intro = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01IntroProbe.cs");
            var start = intro.IndexOf("private IEnumerator BeginPickup()", StringComparison.Ordinal);
            var end = intro.IndexOf("private bool IsFlashlightSupportedByFragment()", start, StringComparison.Ordinal);
            Assert.True(start >= 0 && end > start);
            var pickupBlock = intro.Substring(start, end - start);

            Assert.Contains("M01IntroFlow.ResolvePickupApproachX", pickupBlock);
            Assert.Contains("lemmy.SetFacing(flashX >= CurrentLemmyX())", pickupBlock);
            Assert.DoesNotContain("flashX - 30f", pickupBlock);
        }

        [Fact(DisplayName = "a full target platform validates even when a wrong-angle piece was only stuck to its slot")]
        public void FullTargetPlatformAlwaysTriggersValidation()
        {
            var drag = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01DragProbe.cs");

            Assert.Contains("placementLedger", drag);
            Assert.Contains("AllTargetSlotsPositionOccupied", drag);
            Assert.Contains("StickFragmentToSlot", drag);
            Assert.Contains("ScheduleFailedCandidateReturn", drag);
        }

        [Fact(DisplayName = "target-pattern evidence uses the fragments actually occupying each slot, including wrong-color candidates")]
        public void TargetPatternEvidenceUsesLiveSlotOccupants()
        {
            var drag = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01DragProbe.cs");

            Assert.Contains("TrySubmitTargetPatternEvidencePairs", drag);
            Assert.Contains("TryGetPoseCorrectSlotOccupant(firstSlot, out var firstOccupant)", drag);
            Assert.Contains("TryGetPoseCorrectSlotOccupant(secondSlot, out var secondOccupant)", drag);
            Assert.Contains("placementLedger.TryGetSlotOccupant(slot.Id", drag);
            Assert.Contains("session.SubmitEvidencePair(ev.Id, new[] { firstOccupant, secondOccupant })", drag);
        }

        [Fact(DisplayName = "validation renders fragment reveal colors and geometric overlap blend colors in real time")]
        public void ValidationRendersFragmentAndOverlapColors()
        {
            var drag = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01DragProbe.cs");
            var board = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01BoardProbe.cs");

            Assert.Contains("ValidationColor", drag);
            Assert.Contains("RenderValidationBlendOverlays", drag);
            Assert.Contains("M01StandardPieceBlend.ResolveOverlays", board);
            Assert.Contains("TargetOverlapColor", board);
        }

        [Fact(DisplayName = "disabling the board releases generated validation sprites before losing their cache keys")]
        public void BoardDisableReleasesGeneratedValidationSprites()
        {
            var board = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01BoardProbe.cs");
            var start = board.IndexOf("private void OnDisable()", StringComparison.Ordinal);
            var end = board.IndexOf("private void Build()", start, StringComparison.Ordinal);
            Assert.True(start >= 0 && end > start);
            var disableBlock = board.Substring(start, end - start);

            var release = disableBlock.IndexOf("ReleaseValidationOverlaySprites()", StringComparison.Ordinal);
            var loseRoot = disableBlock.IndexOf("validationOverlayRoot = null", StringComparison.Ordinal);
            Assert.True(release >= 0, "OnDisable must release generated validation sprites");
            Assert.True(release < loseRoot, "generated sprites must be released before overlay handles are cleared");
            Assert.DoesNotContain("validationOverlaySpriteKeys.Clear()", disableBlock);

            var helperStart = board.IndexOf("private void ReleaseValidationOverlaySprites()", StringComparison.Ordinal);
            var helperEnd = board.IndexOf("private void SetupCamera()", helperStart, StringComparison.Ordinal);
            Assert.True(helperStart >= 0 && helperEnd > helperStart);
            var helperBlock = board.Substring(helperStart, helperEnd - helperStart);
            var remove = helperBlock.IndexOf("spriteCache.Remove(key, out var sprite)", StringComparison.Ordinal);
            var clear = helperBlock.IndexOf("validationOverlaySpriteKeys.Clear()", StringComparison.Ordinal);

            Assert.True(remove >= 0, "overlay sprites must be removed from the cache");
            Assert.Contains("Destroy(sprite)", helperBlock);
            Assert.Contains("Destroy(texture)", helperBlock);
            Assert.True(remove < clear, "cache entries must be released before their keys are cleared");
        }

        [Fact(DisplayName = "opening does not render the Cocos reference-pattern node whose live sprite is transparent")]
        public void OpeningDoesNotRenderTransparentReferencePattern()
        {
            var board = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01BoardProbe.cs");

            Assert.DoesNotContain("RenderReferencePattern(root, layout.ReferencePattern", board);
        }

        [Fact(DisplayName = "opening gear and basket compensate Unity Linear watercolor rendering without changing the Cocos source truth")]
        public void OpeningWatercolorArtUsesUnityLinearCompensation()
        {
            var board = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01BoardProbe.cs");
            var intro = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01IntroProbe.cs");

            Assert.Contains("M01VisualParity.UnityLinearGearSpriteTint", board);
            Assert.Contains("M01VisualParity.UnityLinearBasketSpriteTint", intro);
            Assert.Contains("sr.color = tint", board);
            Assert.DoesNotContain("sr.color = Color.white", board);
        }

        [Fact(DisplayName = "opening freezes basket fragments only after applying the stable Cocos settled pose")]
        public void OpeningFreezesAtCocosSettledPose()
        {
            var intro = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01IntroProbe.cs");
            var start = intro.IndexOf("private IEnumerator FreezeBasketPileAfterDelay()", StringComparison.Ordinal);
            var end = intro.IndexOf("private void SetBasketCavityActive", start, StringComparison.Ordinal);
            Assert.True(start >= 0 && end > start);
            var freezeBlock = intro.Substring(start, end - start);

            Assert.Contains("ApplyCocosSettledBasketPose()", freezeBlock);
            Assert.True(
                freezeBlock.IndexOf("ApplyCocosSettledBasketPose()", StringComparison.Ordinal) <
                freezeBlock.IndexOf("SetUnreleasedBasketPiecePhase(M01IntroBasketPiecePhase.Frozen)", StringComparison.Ordinal));
        }

        [Fact(DisplayName = "failed validation cancels every delayed rotate pin before resetting fragments")]
        public void FailedValidationCancelsRotatePinsBeforeReset()
        {
            var drag = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01DragProbe.cs");
            var start = drag.IndexOf("private IEnumerator ReturnFailedCandidateAfterDelay", StringComparison.Ordinal);
            var end = drag.IndexOf("private bool AllTargetSlotsPositionOccupied", start, StringComparison.Ordinal);
            Assert.True(start >= 0 && end > start);
            var resetBlock = drag.Substring(start, end - start);

            var cancel = resetBlock.IndexOf("CancelAllRotatePins()", StringComparison.Ordinal);
            var reset = resetBlock.IndexOf("session.ResetCandidateStructure()", StringComparison.Ordinal);
            Assert.True(cancel >= 0, "failure reset must cancel delayed rotate-pin coroutines");
            Assert.True(cancel < reset, "rotate pins must be cancelled before candidate state is reset");
        }

        [Fact(DisplayName = "weak evidence always resubmits its ordered latest pair")]
        public void WeakEvidenceResubmitsLatestPair()
        {
            var drag = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01DragProbe.cs");

            Assert.Contains("placementLedger.TryGetWeakPair", drag);
            Assert.Contains("session.SubmitEvidencePair(ev.ControllerId, pair)", drag);
            Assert.DoesNotContain("if (session.IsEvidenceStaged(ev.ControllerId)) continue", drag);
        }

        [Fact(DisplayName = "Lemmy frames use high-quality compression and a bounded runtime cache")]
        public void LemmyAnimationMemoryIsBounded()
        {
            var importer = ReadRepoFile("StarGuardian/Assets/Editor/M01RenderAssetImporter.cs");
            var animator = ReadRepoFile("StarGuardian/Assets/GlowProbe/M01LemmyAnimator.cs");

            Assert.Contains("LemmyRoot", importer);
            Assert.Contains("override uint GetVersion()", importer);
            Assert.Contains("assetPath.EndsWith(\".png\"", importer);
            Assert.Contains("TextureImporterCompression.CompressedHQ", importer);
            Assert.Contains("MaxCachedClips", animator);
            Assert.Contains("TrimClipCache", animator);
            Assert.Contains("Resources.UnloadUnusedAssets", animator);
        }

        private static string ReadRepoFile(string relativePath)
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);
            while (directory != null && !Directory.Exists(Path.Combine(directory.FullName, "StarGuardian")))
            {
                directory = directory.Parent;
            }

            Assert.NotNull(directory);
            return File.ReadAllText(Path.Combine(directory!.FullName, relativePath));
        }
    }
}
