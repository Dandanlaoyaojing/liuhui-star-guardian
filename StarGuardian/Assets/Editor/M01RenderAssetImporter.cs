#if UNITY_EDITOR

using UnityEditor;
using UnityEngine;

/// <summary>Deterministic import settings required by the Cocos M01 render contract.</summary>
public sealed class M01RenderAssetImporter : AssetPostprocessor
{
    private const string Root = "Assets/Resources/Art/M01/";

    private void OnPreprocessTexture()
    {
        if (!assetPath.StartsWith(Root, System.StringComparison.Ordinal)) return;
        var importer = (TextureImporter)assetImporter;
        // Action folders also contain source preview GIFs. They are documentation,
        // not Cocos SpriteFrames; keeping them as Default prevents Resources.LoadAll<Sprite>
        // from silently appending a 698th runtime frame.
        if (!assetPath.EndsWith(".png", System.StringComparison.OrdinalIgnoreCase))
        {
            importer.textureType = TextureImporterType.Default;
            return;
        }
        importer.textureType = TextureImporterType.Sprite;
        importer.spriteImportMode = SpriteImportMode.Single;
        importer.spritePixelsPerUnit = 100f;
        importer.alphaIsTransparency = true;
        importer.mipmapEnabled = false;
        importer.textureCompression = TextureImporterCompression.Uncompressed;
        importer.filterMode = FilterMode.Bilinear;
        importer.wrapMode = TextureWrapMode.Clamp;

        var settings = new TextureImporterSettings();
        importer.ReadTextureSettings(settings);
        settings.spriteMeshType = SpriteMeshType.Tight;
        importer.SetTextureSettings(settings);
    }
}

#endif
