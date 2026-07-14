#nullable enable

using StarGuardian.M01.Rendering;
using UnityEngine;

/// <summary>Unity-side application of the pure M01 Cocos geometry contract.</summary>
public static class M01CocosTransform
{
    public static Vector3 WorldPosition(double cocosX, double cocosY, float z = 0f)
    {
        var point = M01RenderGeometry.CocosPxToUnityWorld(cocosX, cocosY);
        return new Vector3((float)point.X, (float)point.Y, z);
    }

    public static Quaternion WorldRotation(double cocosEulerZ) =>
        Quaternion.Euler(0f, 0f, (float)M01RenderGeometry.CocosEulerZToUnityZ(cocosEulerZ));

    public static void ApplyLocalPose(Transform target, double cocosX, double cocosY, double cocosEulerZ = 0)
    {
        target.localPosition = WorldPosition(cocosX, cocosY);
        target.localRotation = WorldRotation(cocosEulerZ);
    }
}
