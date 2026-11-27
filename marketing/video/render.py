"""
Renderuje film promocyjny Timeblame klatka po klatce (deterministycznie) i składa MP4 przez ffmpeg.

    pip install playwright && playwright install chromium     # + ffmpeg w PATH
    python marketing/video/render.py                           # wszystkie formaty, EN i PL
    python marketing/video/render.py --langs en --formats 9x16 --url timeblame.com
    python marketing/video/render.py --stills 2,7.6,11.2,15.6,20.8,24.5   # tylko podgląd klatek

Formaty:
    16x9  1920x1080  YouTube, strona, LinkedIn wideo
    9x16  1080x1920  Reels, TikTok, Shorts, Stories
    1x1   1080x1080  posty w feedzie (Meta, LinkedIn)
Dodatkowo powstaje lekka wersja na stronę (1280x720) i postery AVIF/WebP (1280/800/640).
Pliki: out/promo-{lang}-{format}.mp4, out/promo-{lang}-web.mp4, out/promo-{lang}-poster-*.
Wersję web i postery kopiujemy do public/media (landing wybiera je po języku).
"""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
TEMPLATE = (HERE / "promo.html").as_uri()
FORMATS = {"16x9": (1920, 1080), "9x16": (1080, 1920), "1x1": (1080, 1080)}


def ffmpeg_writer(out: Path, fps: int, crf: int, scale: str | None = None) -> subprocess.Popen:
    vf = ["-vf", f"scale={scale}:flags=lanczos"] if scale else []
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "image2pipe", "-framerate", str(fps), "-i", "-",
        *vf,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", str(crf),
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(out),
    ]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


POSTER_WIDTHS = (1280, 800, 640)


def posters(png: Path, out_dir: Path, lang: str) -> None:
    """Postery dla <video poster> i <picture>: AVIF + WebP w trzech szerokościach."""
    from PIL import Image

    with Image.open(png) as img:
        img = img.convert("RGB")
        for width in POSTER_WIDTHS:
            frame = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
            frame.save(out_dir / f"promo-{lang}-poster-{width}.avif", quality=55)
            frame.save(out_dir / f"promo-{lang}-poster-{width}.webp", quality=78, method=6)


def render(fmt: str, lang: str, out_dir: Path, fps: int, url: str | None, web_version: bool) -> None:
    w, h = FORMATS[fmt]
    query = f"?lang={lang}" + (f"&url={url}" if url else "")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": w, "height": h})
        page.goto(TEMPLATE + query)
        page.evaluate("window.__ready")
        duration = page.evaluate("window.DURATION")
        frames = int(duration * fps)

        master = ffmpeg_writer(out_dir / f"promo-{lang}-{fmt}.mp4", fps, crf=18)
        web = ffmpeg_writer(out_dir / f"promo-{lang}-web.mp4", fps, crf=27, scale="1280:-2") if web_version else None
        for i in range(frames):
            page.evaluate(f"window.render({i / fps})")
            png = page.screenshot(type="png")
            master.stdin.write(png)
            if web:
                web.stdin.write(png)
            if i % fps == 0:
                print(f"  {lang} {fmt}: {i // fps:>2}/{int(duration)} s", flush=True)
        for proc in (master, web):
            if proc:
                proc.stdin.close()
                proc.wait()

        if web_version:
            page.evaluate("window.render(11.45)")
            poster = out_dir / f"promo-{lang}-poster.png"
            page.screenshot(path=str(poster))
            posters(poster, out_dir, lang)
        browser.close()


def stills(times: list[float], lang: str, out_dir: Path) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for fmt, (w, h) in FORMATS.items():
            page = browser.new_page(viewport={"width": w, "height": h})
            page.goto(f"{TEMPLATE}?lang={lang}")
            page.evaluate("window.__ready")
            for t in times:
                page.evaluate(f"window.render({t})")
                page.screenshot(path=str(out_dir / f"still-{lang}-{fmt}-{t:05.2f}.png"))
        browser.close()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--formats", default="16x9,9x16,1x1")
    ap.add_argument("--langs", default="en,pl", help="języki napisów: en, pl")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--url", default=None, help="adres na planszy końcowej, np. timeblame.com")
    ap.add_argument("--out", default=str(HERE / "out"))
    ap.add_argument("--stills", default=None, help="lista czasów (s) do podglądu, bez renderu wideo")
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    if args.stills:
        for lang in args.langs.split(","):
            stills([float(x) for x in args.stills.split(",")], lang, out_dir)
        return
    for lang in args.langs.split(","):
        for fmt in args.formats.split(","):
            print(f"Renderuję {lang} {fmt}…", flush=True)
            render(fmt, lang, out_dir, args.fps, args.url, web_version=(fmt == "16x9"))
    print("Gotowe:", *sorted(p.name for p in out_dir.glob("*.mp4")))


if __name__ == "__main__":
    main()
