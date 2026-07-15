#nullable enable

using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using StarGuardian.M01;
using UnityEditor;
using UnityEngine;

public static class M01InteractionGlueVerifier
{
    public static void Run()
    {
        try
        {
            VerifyFragmentSortingOrder();
            VerifyParkedFragmentBody();
            VerifyPickupCoroutineWiring();
            VerifyFoldedPickupPlayback();
            Debug.Log("M01InteractionGlueVerifier: passed 4/4");
            EditorApplication.Exit(0);
        }
        catch (Exception exception)
        {
            Debug.LogException(exception);
            EditorApplication.Exit(1);
        }
    }

    private static void VerifyFragmentSortingOrder()
    {
        var fragment = new GameObject("fragment");
        var edge = new GameObject("edge");
        var nestedInk = new GameObject("nested-ink");
        try
        {
            edge.transform.SetParent(fragment.transform, false);
            nestedInk.transform.SetParent(edge.transform, false);
            var bodyRenderer = fragment.AddComponent<SpriteRenderer>();
            var edgeRenderer = edge.AddComponent<SpriteRenderer>();
            var nestedInkRenderer = nestedInk.AddComponent<SpriteRenderer>();

            M01BoardProbe.SetFragmentSortingOrder(fragment, 60);

            Require(bodyRenderer.sortingOrder == 60, "fragment body sorting order must be 60");
            Require(edgeRenderer.sortingOrder == 61, "edge sorting order must be 61");
            Require(nestedInkRenderer.sortingOrder == 62, "nested ink sorting order must be 62");
        }
        finally
        {
            UnityEngine.Object.DestroyImmediate(fragment);
        }
    }

    private static void VerifyParkedFragmentBody()
    {
        var fragment = new GameObject("incoming-fragment");
        try
        {
            var body = fragment.AddComponent<Rigidbody2D>();
            body.bodyType = RigidbodyType2D.Dynamic;
            body.gravityScale = 3f;
            var collider = fragment.AddComponent<BoxCollider2D>();
            collider.enabled = false;

            var parkMethod = typeof(M01DragProbe).GetMethod(
                "ParkFragmentBody",
                BindingFlags.Static | BindingFlags.NonPublic);
            Require(parkMethod != null, "ParkFragmentBody must exist");
            parkMethod!.Invoke(null, new object[] { fragment });

            Require(body.bodyType == RigidbodyType2D.Kinematic, "parked body must be Kinematic");
            Require(body.simulated, "parked body must remain simulated for collisions");
            Require(Mathf.Approximately(body.gravityScale, 0f), "parked body gravity must be zero");
            Require(collider.enabled, "parked body collider must be enabled");
        }
        finally
        {
            UnityEngine.Object.DestroyImmediate(fragment);
        }
    }

    private static void VerifyFoldedPickupPlayback()
    {
        var lemmyObject = new GameObject("lemmy-folded-pickup");
        try
        {
            var animator = lemmyObject.AddComponent<M01LemmyAnimator>();
            if (lemmyObject.transform.childCount == 0)
            {
                var awakeMethod = typeof(M01LemmyAnimator).GetMethod(
                    "Awake",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                Require(awakeMethod != null, "M01LemmyAnimator.Awake must exist");
                awakeMethod!.Invoke(animator, Array.Empty<object>());
            }

            animator.Play("crouchback");
            var spriteRenderer = lemmyObject.GetComponentInChildren<SpriteRenderer>();
            Require(spriteRenderer != null, "Lemmy sprite renderer must exist");
            Require(
                spriteRenderer!.sprite != null && spriteRenderer.sprite.name == "crouchback-00",
                "folded crouch must start at crouchback-00");

            animator.PlayReverse("crouchback");
            Require(
                spriteRenderer.sprite != null && spriteRenderer.sprite.name == "crouchback-27",
                "folded rise must start at crouchback-27");

            var reverseIndices = GetField<int[]>(animator, "sourceFrameIndices");
            Require(
                reverseIndices.SequenceEqual(Enumerable.Range(0, 28).Reverse()),
                "folded rise must preserve the complete crouchback-27..00 source order");

            SetField(animator, "timerMs", 100000d);
            InvokePrivate(animator, "Update");
            Require(animator.Done, "folded rise must reach Done=true");
            Require(
                spriteRenderer.sprite != null && spriteRenderer.sprite.name == "crouchback-00",
                "folded rise must finish at crouchback-00");
        }
        finally
        {
            UnityEngine.Object.DestroyImmediate(lemmyObject);
        }
    }

    private static void VerifyPickupCoroutineWiring()
    {
        VerifyPickupScenario(
            "folded-ground",
            lemmyX: 300f,
            earsFolded: true,
            supportedByFragment: false,
            expectedAction: "crouchback",
            expectedReverseFirstFrame: "crouchback-27");
        VerifyPickupScenario(
            "upright-ground",
            lemmyX: 0f,
            earsFolded: false,
            supportedByFragment: false,
            expectedAction: "crouch",
            expectedReverseFirstFrame: "crouch-39");
        VerifyPickupScenario(
            "fragment-supported",
            lemmyX: 300f,
            earsFolded: true,
            supportedByFragment: true,
            expectedAction: null,
            expectedReverseFirstFrame: null);
    }

    private static void VerifyPickupScenario(
        string id,
        float lemmyX,
        bool earsFolded,
        bool supportedByFragment,
        string? expectedAction,
        string? expectedReverseFirstFrame)
    {
        var host = new GameObject("pickup-host:" + id);
        host.SetActive(false);
        var lemmyObject = new GameObject("pickup-lemmy:" + id);
        var flashlightObject = new GameObject("pickup-flashlight:" + id);
        GameObject? fragmentObject = null;
        try
        {
            var board = host.AddComponent<M01BoardProbe>();
            var intro = host.AddComponent<M01IntroProbe>();
            var animator = lemmyObject.AddComponent<M01LemmyAnimator>();
            EnsureAnimatorAwake(animator);
            animator.SetCocosPosition(lemmyX, -190f);

            flashlightObject.transform.position = M01CocosTransform.WorldPosition(lemmyX, -220f);
            var flashlightBody = flashlightObject.AddComponent<Rigidbody2D>();
            flashlightBody.bodyType = RigidbodyType2D.Dynamic;
            flashlightBody.gravityScale = 0f;
            var flashlightCollider = flashlightObject.AddComponent<BoxCollider2D>();
            flashlightCollider.size = new Vector2(0.4f, 0.4f);

            if (supportedByFragment)
            {
                fragmentObject = new GameObject("pickup-support:" + id);
                fragmentObject.transform.position = M01CocosTransform.WorldPosition(lemmyX, -235f);
                var fragmentCollider = fragmentObject.AddComponent<BoxCollider2D>();
                fragmentCollider.size = new Vector2(0.5f, 0.4f);
                var fragments = GetField<Dictionary<string, GameObject>>(board, "fragmentObjects");
                fragments.Add("support", fragmentObject);
                Physics2D.SyncTransforms();
                var previousSimulationMode = Physics2D.simulationMode;
                try
                {
                    Physics2D.simulationMode = SimulationMode2D.Script;
                    Physics2D.Simulate(0.02f);
                    Require(flashlightCollider.IsTouching(fragmentCollider), "pickup support colliders must touch");
                }
                finally
                {
                    Physics2D.simulationMode = previousSimulationMode;
                }
            }

            SetField(intro, "board", board);
            SetField(intro, "lemmy", animator);
            SetField(intro, "flashlightObject", flashlightObject);
            SetField(intro, "phase", M01IntroPhase.WaitingPickup);
            SetField(intro, "earsFolded", earsFolded);

            var pickup = (IEnumerator)InvokePrivate(intro, "BeginPickup")!;
            var yielded = pickup.MoveNext();
            if (expectedAction == null)
            {
                Require(!yielded, id + " must complete without entering a crouch coroutine");
                Require(
                    animator.CurrentAction != "crouch" && animator.CurrentAction != "crouchback",
                    id + " must not play a crouch action");
                Require(intro.Phase == M01IntroPhase.Acquired, id + " must complete pickup");
                return;
            }

            Require(yielded && pickup.Current is IEnumerator, id + " must yield its crouch action");
            var crouch = (IEnumerator)pickup.Current;
            Require(crouch.MoveNext(), id + " crouch must wait for animator completion");
            Require(animator.CurrentAction == expectedAction, id + " must play " + expectedAction);

            SetAutoProperty(animator, "Done", true);
            Require(!crouch.MoveNext(), id + " crouch wait must finish when the animator is done");
            Require(pickup.MoveNext(), id + " must start the rise after attaching the flashlight");
            Require(animator.CurrentAction == expectedAction, id + " rise must reverse the same action");
            var spriteRenderer = lemmyObject.GetComponentInChildren<SpriteRenderer>();
            Require(
                spriteRenderer != null && spriteRenderer.sprite != null &&
                spriteRenderer.sprite.name == expectedReverseFirstFrame,
                id + " rise must start at " + expectedReverseFirstFrame);
        }
        finally
        {
            if (fragmentObject != null) UnityEngine.Object.DestroyImmediate(fragmentObject);
            UnityEngine.Object.DestroyImmediate(flashlightObject);
            UnityEngine.Object.DestroyImmediate(lemmyObject);
            UnityEngine.Object.DestroyImmediate(host);
        }
    }

    private static void EnsureAnimatorAwake(M01LemmyAnimator animator)
    {
        if (animator.transform.childCount == 0) InvokePrivate(animator, "Awake");
    }

    private static object? InvokePrivate(object target, string method)
    {
        var info = target.GetType().GetMethod(method, BindingFlags.Instance | BindingFlags.NonPublic);
        Require(info != null, target.GetType().Name + "." + method + " must exist");
        return info!.Invoke(target, Array.Empty<object>());
    }

    private static T GetField<T>(object target, string field)
    {
        var info = target.GetType().GetField(field, BindingFlags.Instance | BindingFlags.NonPublic);
        Require(info != null, target.GetType().Name + "." + field + " must exist");
        return (T)info!.GetValue(target)!;
    }

    private static void SetField(object target, string field, object value)
    {
        var info = target.GetType().GetField(field, BindingFlags.Instance | BindingFlags.NonPublic);
        Require(info != null, target.GetType().Name + "." + field + " must exist");
        info!.SetValue(target, value);
    }

    private static void SetAutoProperty(object target, string property, object value) =>
        SetField(target, "<" + property + ">k__BackingField", value);

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }
}
