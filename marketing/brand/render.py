"""
Renderuje obraz Open Graph i ikony aplikacji do public/.

    pip install playwright pillow && playwright install chromium
    python marketing/brand/render.py
"""
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
TEMPLATE = (Path(__file__).parent / "og-image.html").as_uri()


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # og.png po angielsku (domyślny język), og-pl.png dla polskiej wersji strony
        for lang, name in (("en", "og.png"), ("pl", "og-pl.png")):
            page = browser.new_page(viewport={"width": 1200, "height": 630})
            page.goto(f"{TEMPLATE}?lang={lang}")
            page.evaluate("document.fonts.ready")
            page.screenshot(path=str(PUBLIC / name))

        for name, maskable in (("icon-512.png", False), ("icon-maskable-512.png", True)):
            icon = browser.new_page(viewport={"width": 512, "height": 512})
            icon.goto(TEMPLATE)
            icon.evaluate(
                """(maskable) => {
                    document.getElementById('og').hidden = true;
                    const el = document.getElementById('icon');
                    el.hidden = false;
                    el.classList.toggle('maskable', maskable);
                    if (!maskable) el.style.borderRadius = '112px';
                    document.body.style.cssText = 'width:512px;height:512px;background:transparent';
                }""",
                maskable,
            )
            icon.screenshot(path=str(PUBLIC / name), omit_background=not maskable)
        browser.close()

    base = Image.open(PUBLIC / "icon-512.png").convert("RGBA")
    base.resize((192, 192), Image.LANCZOS).save(PUBLIC / "icon-192.png", optimize=True)
    # Apple nie lubi przezroczystości: ikona na pełnym tle.
    apple = Image.open(PUBLIC / "icon-maskable-512.png").convert("RGB").resize((180, 180), Image.LANCZOS)
    apple.save(PUBLIC / "apple-touch-icon.png", optimize=True)
    base.save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

    for name in ("og.png", "og-pl.png"):
        og = Image.open(PUBLIC / name).convert("RGB")
        og.save(PUBLIC / name, optimize=True)
    for f in sorted(PUBLIC.glob("*.png")) + [PUBLIC / "favicon.ico"]:
        print(f"{f.name:28} {f.stat().st_size / 1024:6.1f} KB")


if __name__ == "__main__":
    main()
