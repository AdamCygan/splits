"""
Renderuje pionowe shorty Timeblame (1080x1920, 30 kl./s) w dwóch językach.

    python marketing/video/shorts.py                                # 6 plików: out/short-{historia}-{en,pl}.mp4
    python marketing/video/shorts.py --stories pause --langs pl     # wybrane
    python marketing/video/shorts.py --url timeblame.com               # adres zamiast „Link w bio”
    python marketing/video/shorts.py --stills 1.5,5,10,14,19        # tylko klatki kontrolne (PNG)

Historie: sprint, pause, invoice, review, pairing, meetings, extra, estimate, forgot, templates, summary,
overrun, estvsreal, pastday, anyproject, overtime, taskedit, yearreview, jiralink, switching, demo
(opis każdej w nagłówku shorts.html i w marketing/README.md).
Wymagania jak dla render.py: playwright z chromium i ffmpeg.
"""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
TEMPLATE = (HERE / "shorts.html").as_uri()
W, H = 1080, 1920


def writer(out: Path, fps: int) -> subprocess.Popen:
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "image2pipe", "-framerate", str(fps), "-i", "-",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(out),
    ]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


def open_page(browser, story: str, lang: str, url: str | None):
    page = browser.new_page(viewport={"width": W, "height": H})
    query = f"?story={story}&lang={lang}" + (f"&url={url}" if url else "")
    page.goto(TEMPLATE + query)
    page.evaluate("window.__ready")
    return page


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stories", default="sprint,pause,invoice,review,pairing,meetings,extra,estimate,forgot,templates,summary,overrun,estvsreal,pastday,anyproject,overtime,taskedit,yearreview,jiralink,switching,demo")
    ap.add_argument("--langs", default="en,pl")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--url", default=None)
    ap.add_argument("--out", default=str(HERE / "out"))
    ap.add_argument("--stills", default=None, help="czasy (s) klatek kontrolnych, bez wideo")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for story in args.stories.split(","):
            for lang in args.langs.split(","):
                page = open_page(browser, story, lang, args.url)
                if args.stills:
                    for t in (float(x) for x in args.stills.split(",")):
                        page.evaluate(f"window.render({t})")
                        page.screenshot(path=str(out / f"still-{story}-{lang}-{t:05.2f}.png"))
                    page.close()
                    continue
                duration = page.evaluate("window.DURATION")
                target = out / f"short-{story}-{lang}.mp4"
                proc = writer(target, args.fps)
                for i in range(int(duration * args.fps)):
                    page.evaluate(f"window.render({i / args.fps})")
                    proc.stdin.write(page.screenshot(type="png"))
                proc.stdin.close()
                proc.wait()
                page.close()
                print(f"✓ {target.name} ({duration:.0f} s)", flush=True)
        browser.close()


if __name__ == "__main__":
    main()
