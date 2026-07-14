#nullable enable

using StarGuardian.M01.Rendering;
using UnityEngine;

/// <summary>
/// Applies Cocos UITransform displaySize/anchor semantics to a Unity SpriteRenderer.
/// Uses the Sprite's tight bounds as the Cocos SpriteFrame.rect equivalent, including its
/// center offset inside an untrimmed source canvas.
/// </summary>
public static class M01SpriteAspect
{
    public static M01RenderSize Fit(
        SpriteRenderer renderer,
        double displayWidthPx,
        double displayHeightPx,
        string axis = "contain",
        double anchorX = 0.5,
        double anchorY = 0.5,
        double renderScale = 1,
        double additionalLiftPx = 0,
        bool flipX = false)
    {
        var sprite = renderer.sprite;
        if (sprite == null)
        {
            return new M01RenderSize(displayWidthPx, displayHeightPx);
        }

        var bounds = sprite.bounds;
        var sourceWidthPx = bounds.size.x * sprite.pixelsPerUnit;
        var sourceHeightPx = bounds.size.y * sprite.pixelsPerUnit;
        var fitted = M01RenderGeometry.AspectContentSize(
            sourceWidthPx,
            sourceHeightPx,
            displayWidthPx * renderScale,
            displayHeightPx * renderScale,
            axis);

        var scaleX = bounds.size.x > 0f
            ? (float)(fitted.Width / M01RenderContract.PixelsPerUnit) / bounds.size.x
            : 1f;
        var scaleY = bounds.size.y > 0f
            ? (float)(fitted.Height / M01RenderContract.PixelsPerUnit) / bounds.size.y
            : 1f;
        renderer.transform.localScale = new Vector3(flipX ? -scaleX : scaleX, scaleY, 1f);

        var anchorOffset = M01RenderGeometry.AnchorCenterOffsetPx(
            fitted.Width,
            fitted.Height,
            anchorX,
            anchorY);
        var desiredCenter = M01CocosTransform.WorldPosition(
            anchorOffset.X,
            anchorOffset.Y + additionalLiftPx);
        var scaledBoundsCenter = Vector3.Scale(bounds.center, renderer.transform.localScale);
        renderer.transform.localPosition = desiredCenter - scaledBoundsCenter;

        return fitted;
    }
}
