from pathlib import Path
import base64
import re

HTML_FILE = Path("ui.html")
OUTPUT_FILE = Path("ui_embedded.html")
IMAGE_DIR = Path("images")

MIME_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
}

if not HTML_FILE.exists():
    print("ERROR: ui.html was not found.")
    print(f"Current folder: {Path.cwd()}")
    raise SystemExit(1)

if not IMAGE_DIR.exists():
    print("ERROR: images folder was not found.")
    print(f"Expected: {IMAGE_DIR.resolve()}")
    raise SystemExit(1)

html = HTML_FILE.read_text(encoding="utf-8")

embedded_count = 0
missing = []

def replace_image(match):
    global embedded_count

    original_path = match.group(1)

    # Normalize paths such as ./images/file.png
    clean_path = original_path.replace("\\", "/")
    clean_path = re.sub(r"^\./", "", clean_path)

    if not clean_path.startswith("images/"):
        return match.group(0)

    image_path = Path(clean_path)

    if not image_path.exists():
        missing.append(clean_path)
        return match.group(0)

    extension = image_path.suffix.lower()

    if extension not in MIME_TYPES:
        print(f"SKIPPED unsupported image: {clean_path}")
        return match.group(0)

    image_data = base64.b64encode(image_path.read_bytes()).decode("ascii")

    data_uri = f"data:{MIME_TYPES[extension]};base64,{image_data}"

    embedded_count += 1
    print(f"Embedded: {clean_path}")

    return f'src="{data_uri}"'


# Find image src="images/..."
pattern = r'src=["\']([^"\']+)["\']'

html = re.sub(
    pattern,
    lambda match: replace_image(
        type("MatchWrapper", (), {
            "group": lambda self, n: match.group(1)
        })()
    ) if match.group(1).startswith(("images/", "./images/"))
    else match.group(0),
    html
)

OUTPUT_FILE.write_text(html, encoding="utf-8")

print()
print("--------------------------------")
print(f"Embedded images: {embedded_count}")
print(f"Output: {OUTPUT_FILE.resolve()}")

if missing:
    print()
    print("Images referenced by ui.html but not found:")
    for item in missing:
        print(f"  - {item}")