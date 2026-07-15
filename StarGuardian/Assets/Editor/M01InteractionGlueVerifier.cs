using System;
using System.Reflection;
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
            VerifyFoldedPickupPlayback();
            Debug.Log("M01InteractionGlueVerifier: passed 3/3");
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
        }
        finally
        {
            UnityEngine.Object.DestroyImmediate(lemmyObject);
        }
    }

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }
}
