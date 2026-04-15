"""
Fix sponsor assets for Android compatibility:
- Decode WebP files (even if renamed to .png/.jpg)
- Convert RGBA → RGB (white background composite)
- Strip all metadata
- Save as proper PNG (for logos) or JPEG (for photos)
- Rename to lowercase safe filenames
"""
from PIL import Image
import os
import shutil

SPONSORS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "sponsors")

# Map: original filename → (output filename, output format)
FIXES = {
    "MUZLOGO.png":   ("muzlogo.png",   "PNG"),
    "MUZFLAG.jpg":   ("muzflag.jpg",   "JPEG"),
    "MUZFORALL.jpg": ("muzforall.jpg", "JPEG"),
}

def fix_image(src_path: str, dst_path: str, fmt: str) -> None:
    img = Image.open(src_path)
    print(f"  Input:  format={img.format}, mode={img.mode}, size={img.size}")

    # Flatten RGBA/P/LA → RGB with white background
    if img.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        if img.mode in ("RGBA", "LA"):
            bg.paste(img, mask=img.split()[-1])
        else:
            bg.paste(img)
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Save with no metadata (no exif, no icc_profile, no comment)
    save_kwargs: dict = {}
    if fmt == "PNG":
        save_kwargs = {"optimize": True}
    elif fmt == "JPEG":
        save_kwargs = {"quality": 90, "optimize": True, "subsampling": 0}

    img.save(dst_path, format=fmt, **save_kwargs)
    out = Image.open(dst_path)
    print(f"  Output: format={out.format}, mode={out.mode}, size={out.size}, metadata={bool(out.info)}")


def main() -> None:
    for original, (fixed_name, fmt) in FIXES.items():
        src = os.path.join(SPONSORS_DIR, original)
        dst = os.path.join(SPONSORS_DIR, fixed_name)

        if not os.path.exists(src):
            print(f"[SKIP] {original} not found")
            continue

        print(f"\n[FIX] {original} → {fixed_name} ({fmt})")
        fix_image(src, dst, fmt)

        # Remove the original uppercase file if it differs from the output name
        if original != fixed_name and os.path.exists(src):
            os.remove(src)
            print(f"  Removed original: {original}")

    print("\n[DONE] All sponsor assets fixed.")


if __name__ == "__main__":
    main()
