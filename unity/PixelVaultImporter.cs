using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.U2D.Sprites;
using UnityEngine;

internal static class PixelVaultImporter
{
    [Serializable]
    private class Sheet
    {
        public int version;
        public string image;
        public int width, height, frames, columns, fps, ppu;
        public bool loop, pivotFeet;
    }

    private const string MenuPath = "Assets/Pixel Vault/Import Sprite Sheet and Animation";
    private const string Suffix = ".pixelvault.json";

    [MenuItem(MenuPath, true)]
    private static bool CanImport()
    {
        return Selection.objects.OfType<TextAsset>().Any(IsMetadata);
    }

    private static bool IsMetadata(TextAsset asset) =>
        AssetDatabase.GetAssetPath(asset).EndsWith(Suffix, StringComparison.OrdinalIgnoreCase);

    [MenuItem(MenuPath)]
    private static void Import()
    {
        foreach (var asset in Selection.objects.OfType<TextAsset>().Where(IsMetadata))
        {
            try
            {
                ImportSheet(AssetDatabase.GetAssetPath(asset), JsonUtility.FromJson<Sheet>(asset.text));
            }
            catch (Exception error)
            {
                Debug.LogError($"Pixel Vault: {error.Message}", asset);
            }
        }
    }

    private static void ImportSheet(string metadataPath, Sheet sheet)
    {
        if (sheet == null || sheet.version != 1 || string.IsNullOrEmpty(sheet.image) ||
            Path.GetFileName(sheet.image) != sheet.image || !sheet.image.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ||
            sheet.width < 1 || sheet.width > 512 || sheet.height < 1 || sheet.height > 512 ||
            sheet.frames < 1 || sheet.frames > 120 || sheet.columns < 1 || sheet.columns > 8 ||
            sheet.fps < 1 || sheet.fps > 60 || sheet.ppu < 1 || sheet.ppu > 1024)
            throw new InvalidDataException("Invalid Pixel Vault metadata.");

        string folder = Path.GetDirectoryName(metadataPath).Replace('\\', '/');
        string pngPath = $"{folder}/{sheet.image}";
        if (!(AssetImporter.GetAtPath(pngPath) is TextureImporter importer))
            throw new FileNotFoundException("Place the exported PNG next to the JSON in Assets.", pngPath);

        importer.GetSourceTextureWidthAndHeight(out int sourceWidth, out int sourceHeight);
        int rows = (sheet.frames + sheet.columns - 1) / sheet.columns;
        if (sourceWidth != sheet.columns * sheet.width || sourceHeight != rows * sheet.height)
            throw new InvalidDataException("PNG dimensions do not match the exported frame grid.");

        importer.textureType = TextureImporterType.Sprite;
        importer.spriteImportMode = SpriteImportMode.Multiple;
        importer.spritePixelsPerUnit = sheet.ppu;
        var textureSettings = new TextureImporterSettings();
        importer.ReadTextureSettings(textureSettings);
        textureSettings.spriteMeshType = SpriteMeshType.FullRect;
        importer.SetTextureSettings(textureSettings);
        importer.filterMode = FilterMode.Point;
        importer.wrapMode = TextureWrapMode.Clamp;
        importer.alphaIsTransparency = true;
        importer.mipmapEnabled = false;
        importer.npotScale = TextureImporterNPOTScale.None;
        importer.textureCompression = TextureImporterCompression.Uncompressed;
        importer.maxTextureSize = Mathf.NextPowerOfTwo(Mathf.Max(32, sourceWidth, sourceHeight));
        importer.SaveAndReimport();

        var factories = new SpriteDataProviderFactories();
        factories.Init();
        var provider = factories.GetSpriteEditorDataProviderFromObject(importer);
        provider.InitSpriteEditorDataProvider();
        var previous = provider.GetSpriteRects();
        var rectangles = new SpriteRect[sheet.frames];
        string stem = Path.GetFileNameWithoutExtension(sheet.image);
        for (int i = 0; i < rectangles.Length; i++)
        {
            string name = $"{stem}_{i:D3}";
            var existing = Array.Find(previous, sprite => sprite.name == name);
            rectangles[i] = new SpriteRect
            {
                name = name,
                spriteID = existing == null ? GUID.Generate() : existing.spriteID,
                rect = new Rect(i % sheet.columns * sheet.width,
                    sourceHeight - (i / sheet.columns + 1) * sheet.height, sheet.width, sheet.height),
                alignment = sheet.pivotFeet ? SpriteAlignment.BottomCenter : SpriteAlignment.Center,
                pivot = new Vector2(.5f, sheet.pivotFeet ? 0f : .5f)
            };
        }
        provider.SetSpriteRects(rectangles);
        provider.GetDataProvider<ISpriteNameFileIdDataProvider>()?.SetNameFileIdPairs(
            rectangles.Select(sprite => new SpriteNameFileIdPair(sprite.name, sprite.spriteID)));
        provider.Apply();
        importer.SaveAndReimport();

        var sprites = AssetDatabase.LoadAllAssetsAtPath(pngPath).OfType<Sprite>()
            .ToDictionary(sprite => sprite.name);
        var keys = rectangles.Select((rectangle, index) => new ObjectReferenceKeyframe
        {
            time = index / (float)sheet.fps,
            value = sprites[rectangle.name]
        }).ToList();
        keys.Add(new ObjectReferenceKeyframe { time = sheet.frames / (float)sheet.fps, value = keys.Last().value });

        string clipPath = $"{folder}/{stem}.anim";
        var clip = AssetDatabase.LoadAssetAtPath<AnimationClip>(clipPath);
        bool create = clip == null;
        if (create)
        {
            clipPath = AssetDatabase.GenerateUniqueAssetPath(clipPath);
            clip = new AnimationClip { name = stem };
        }
        clip.frameRate = sheet.fps;
        AnimationUtility.SetObjectReferenceCurve(clip,
            EditorCurveBinding.PPtrCurve("", typeof(SpriteRenderer), "m_Sprite"), keys.ToArray());
        var settings = AnimationUtility.GetAnimationClipSettings(clip);
        settings.loopTime = sheet.loop;
        AnimationUtility.SetAnimationClipSettings(clip, settings);
        if (create) AssetDatabase.CreateAsset(clip, clipPath);
        EditorUtility.SetDirty(clip);
        AssetDatabase.SaveAssets();
        EditorGUIUtility.PingObject(clip);
        Debug.Log($"Pixel Vault: imported {sprites.Count} frames and {clipPath}", clip);
    }
}
