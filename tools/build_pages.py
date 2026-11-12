"""Stage the public Pixel Vault site and derive its catalog from assets/*.png."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct


ROOT = Path(__file__).resolve().parents[1]
SITE_FILES = (".nojekyll", "index.html", "style.css", "effects.js", "character.js", "app.js")
DIRECTIONS = ("Down", "Left", "Right", "Up")
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
STRIP_NAME = re.compile(r"(?P<name>.+)_(?P<frames>[1-9][0-9]*)frames_(?P<width>[1-9][0-9]*)x(?P<height>[1-9][0-9]*)", re.I)
WALK_NAME = re.compile(r"(?P<group>.+)_walk_(?P<direction>down|left|right|top|up)", re.I)


def png_size(path):
    with path.open("rb") as file:
        header = file.read(24)
    if (len(header) != 24 or header[:8] != PNG_SIGNATURE
            or header[8:16] != b"\x00\x00\x00\x0dIHDR"):
        raise ValueError("expected a PNG image with an IHDR header")
    width, height = struct.unpack(">II", header[16:24])
    if not (1 <= width <= 8192 and 1 <= height <= 8192):
        raise ValueError("PNG dimensions must be between 1 and 8192 pixels")
    return width, height


def integer(options, key, default, maximum):
    value = options.get(key, default)
    if type(value) is not int or not 1 <= value <= maximum:
        raise ValueError(f"{key} must be an integer between 1 and {maximum}")
    return value


def label(options, key, default, maximum):
    value = options.get(key, default)
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > maximum:
        raise ValueError(f"{key} must be a non-empty string of up to {maximum} characters")
    return value.strip()


def catalog_entries(path):
    image_width, image_height = png_size(path)
    metadata = path.with_suffix(".json")
    options = json.loads(metadata.read_text(encoding="utf-8-sig")) if metadata.is_file() else {}
    if not isinstance(options, dict):
        raise ValueError("the JSON sidecar must contain an object")

    strip = STRIP_NAME.fullmatch(path.stem) if not options.keys() & {"layout", "frameWidth", "frameHeight", "frames"} else None
    default_layout = "walk4" if (image_width, image_height) == (256, 256) else "single"
    if strip:
        default_layout = "sheet"
    if "frameWidth" in options or "frameHeight" in options:
        default_layout = "sheet"
    layout = options.get("layout", default_layout)
    if layout not in ("walk4", "sheet", "single"):
        raise ValueError("layout must be walk4, sheet, or single")
    if layout == "single" and ("frameWidth" in options or "frameHeight" in options):
        raise ValueError("single uses the full image; use sheet for a custom grid")

    source_width, source_height = image_width, image_height
    walk = None
    default_name = path.stem[:80]
    if strip:
        frames = integer({"frames": int(strip["frames"])}, "frames", 1, 120)
        if image_width % frames:
            raise ValueError("PNG width must be divisible by the number of frames in its filename")
        width = integer({"width": int(strip["width"])}, "width", 64, 512)
        height = integer({"height": int(strip["height"])}, "height", 64, 512)
        source_width = image_width // frames
        default_name = strip["name"].replace("_", " ")[:80]
        walk = WALK_NAME.fullmatch(strip["name"])
        if walk:
            direction = "Up" if walk["direction"].lower() == "top" else walk["direction"].title()
            default_name = f"{walk['group'].replace('_', ' ').title()[:64]} Walk {direction}"
    else:
        width = source_width = integer(options, "frameWidth", 64 if layout == "walk4" else image_width, 512)
        height = source_height = integer(options, "frameHeight", 64 if layout == "walk4" else image_height, 512)
    if image_width % source_width or image_height % source_height:
        raise ValueError("frameWidth and frameHeight must divide the PNG dimensions exactly")
    columns, rows = image_width // source_width, image_height // source_height
    if layout == "walk4" and rows != len(DIRECTIONS):
        raise ValueError("walk4 needs exactly four rows ordered Down, Left, Right, Up")
    capacity = columns if layout == "walk4" else columns * rows
    frames = integer(options, "frames", capacity, min(120, capacity))

    name = label(options, "name", default_name, 80)
    pivot = options.get("pivot", "feet" if layout == "walk4" or walk else "center")
    loop = options.get("loop", frames > 1)
    if pivot not in ("center", "feet") or type(loop) is not bool:
        raise ValueError('pivot must be "center" or "feet", and loop must be true or false')
    asset = {
        "pngFile": path.name,
        "category": label(options, "category", "Characters" if layout == "walk4" or walk else "Sprites", 30),
        "width": width, "height": height, "frames": frames,
        "fps": integer(options, "fps", 8, 60), "ppu": integer(options, "ppu", 64, 1024),
        "loop": loop, "pivot": pivot,
    }
    if strip:
        asset.update(sourceWidth=source_width, sourceHeight=source_height)
    source_id = hashlib.sha256(path.name.encode("utf-8")).hexdigest()[:20]
    if layout == "walk4":
        group = label(options, "group", name, 80)
        return [
            dict(asset, id=f"custom-png-{source_id}-{row}", name=f"{name[:64]} Walk {direction}",
                 start=row * columns, group=group)
            for row, direction in enumerate(DIRECTIONS)
        ]
    default_group = walk["group"].replace("_", " ").title()[:80] if walk else ""
    group = label(options, "group", default_group, 80) if "group" in options or default_group else ""
    return [dict(asset, id=f"custom-png-{source_id}", name=name, start=0, group=group)]


def build(output):
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        raise ValueError(f"Choose an empty output directory: {output}")
    library = json.loads((ROOT / "library.json").read_text(encoding="utf-8-sig"))
    if not isinstance(library, dict) or library.get("version") != 1 or not isinstance(library.get("assets"), list):
        raise ValueError("library.json must be a Pixel Vault library export")
    images = sorted(
        (path for path in (ROOT / "assets").iterdir() if path.is_file() and path.suffix.lower() == ".png"),
        key=lambda path: (path.name.casefold(), path.name),
    )
    for image in images:
        try:
            library["assets"].extend(catalog_entries(image))
        except (OSError, ValueError) as error:
            raise ValueError(f"assets/{image.name}: {error}") from error

    output.mkdir(parents=True, exist_ok=True)
    for name in SITE_FILES:
        shutil.copyfile(ROOT / name, output / name)
    index = output / "index.html"
    index.write_text(index.read_text(encoding="utf-8").replace(
        '<html lang="th">', '<html lang="th" data-library-mode="public">', 1
    ), encoding="utf-8")
    (output / "library.json").write_text(json.dumps(library, ensure_ascii=False), encoding="utf-8")
    (output / "assets").mkdir()
    for image in images:
        shutil.copyfile(image, output / "assets" / image.name)
    print(f"Built {len(library['assets'])} catalog entries from library.json and {len(images)} PNG files.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        build(args.output)
    except (OSError, ValueError) as error:
        parser.exit(1, f"{error}\n")
