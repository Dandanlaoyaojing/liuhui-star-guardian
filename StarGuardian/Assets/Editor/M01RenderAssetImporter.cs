#if UNITY_EDITOR

using UnityEditor;
using UnityEngine;

/// <summary>Deterministic import settings required by the Cocos M01 render contract.</summary>
public sealed class M01RenderAssetImporter : AssetPostprocessor
{
    private const string Root = "Assets/Resources/Art/M01/";
    private const string LemmyRoot = Root + "lemmy/";

    // Bump when import policy changes so Unity invalidates existing artifacts instead of
    // leaving hundreds of already-imported frames on stale settings.
    public override uint GetVersion() => 2;

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
        // 725 张 512² RGBA 动作帧若保持 Uncompressed，理论纹理驻留接近 725 MiB。
        // 只压缩角色动作帧；篮子、平台等已做像素级颜色校准的静态画面继续保持无损导入。
        var isLemmyFrame = assetPath.StartsWith(LemmyRoot, System.StringComparison.Ordinal) &&
                           assetPath.EndsWith(".png", System.StringComparison.OrdinalIgnoreCase);
        importer.textureCompression = isLemmyFrame
            ? TextureImporterCompression.CompressedHQ
            : TextureImporterCompression.Uncompressed;
        importer.compressionQuality = isLemmyFrame ? 100 : importer.compressionQuality;
        importer.filterMode = FilterMode.Bilinear;
        importer.wrapMode = TextureWrapMode.Clamp;

        var settings = new TextureImporterSettings();
        importer.ReadTextureSettings(settings);
        settings.spriteMeshType = SpriteMeshType.Tight;
        importer.SetTextureSettings(settings);
    }
}

#endif
