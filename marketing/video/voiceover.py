"""
Lektor do filmu promocyjnego: ElevenLabs → ścieżka głosu zsynchronizowana ze scenami → MP4 z dźwiękiem
oraz napisy WebVTT/SRT (dostępność: film działa też bez dźwięku).

    export ELEVENLABS_API_KEY=...          # klucz z elevenlabs.io → Profile → API key
    python marketing/video/voiceover.py --name Pointhours                 # EN i PL, wszystkie formaty
    python marketing/video/voiceover.py --langs en --voice <voice_id>
    python marketing/video/voiceover.py --list-voices                 # dostępne głosy
    python marketing/video/voiceover.py --dry-run                     # bez API: ton testowy zamiast głosu

Wejście: out/promo-{lang}-{format}.mp4 (z render.py) i voiceover.json (tekst + czasy).
Wyjście: out/promo-{lang}-{format}-voice.mp4, out/promo-{lang}.vtt/.srt
Opcjonalnie --music plik.mp3: podkład ściszany automatycznie, gdy mówi lektor (sidechain ducking).
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = HERE / "voiceover.json"
FORMATS = ("16x9", "9x16", "1x1", "web")
API = "https://api.elevenlabs.io/v1"
MODEL = "eleven_multilingual_v2"
DURATION = 28.0
MAX_SPEEDUP = 1.12


def api_request(path: str, key: str, body: dict | None = None) -> bytes:
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={"xi-api-key": key, "content-type": "application/json", "accept": "audio/mpeg"},
        method="POST" if body is not None else "GET",
    )
    # Adres zawsze https:// ze stałej API, ścieżki tylko z tego skryptu (nie od użytkownika).
    with urllib.request.urlopen(req, timeout=120) as res:  # noqa: S310  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
        return res.read()


def probe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout
    return float(out.strip())


def synthesize(text: str, voice: str, key: str | None, target: Path, dry_run: bool) -> None:
    if dry_run:
        # ~2.7 słowa na sekundę: tyle mniej więcej trwa naturalna narracja
        seconds = max(0.8, len(text.split()) / 2.7)
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"sine=frequency=440:duration={seconds:.2f}",
             "-af", "volume=0.15", str(target)],
            check=True,
        )
        return
    assert key
    audio = api_request(
        f"/text-to-speech/{voice}?output_format=mp3_44100_128",
        key,
        {
            "text": text,
            "model_id": MODEL,
            "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.25, "use_speaker_boost": True},
        },
    )
    target.write_bytes(audio)


def fit(clip: Path, slot: float, work: Path) -> tuple[Path, float]:
    """Za długi fragment lekko przyspieszamy (atempo zachowuje wysokość głosu)."""
    length = probe_duration(clip)
    if length <= slot:
        return clip, length
    factor = min(MAX_SPEEDUP, length / slot)
    if length / slot > MAX_SPEEDUP:
        print(f"  ! fragment {clip.name} ({length:.2f}s) nie mieści się w {slot:.2f}s, skróć tekst", file=sys.stderr)
    fast = work / f"{clip.stem}-fit.mp3"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(clip), "-filter:a", f"atempo={factor:.3f}", str(fast)], check=True)
    return fast, length / factor


def stamp(seconds: float, sep: str) -> str:
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def write_captions(cues: list[tuple[float, float, str]], base: Path) -> None:
    vtt = ["WEBVTT", ""]
    srt: list[str] = []
    for i, (start, end, text) in enumerate(cues, 1):
        vtt += [f"{stamp(start, '.')} --> {stamp(end, '.')}", text, ""]
        srt += [str(i), f"{stamp(start, ',')} --> {stamp(end, ',')}", text, ""]
    base.with_suffix(".vtt").write_text("\n".join(vtt), encoding="utf-8")
    base.with_suffix(".srt").write_text("\n".join(srt), encoding="utf-8")


def build_voice_track(clips: list[tuple[Path, float]], target: Path) -> None:
    inputs: list[str] = []
    filters: list[str] = []
    for i, (clip, start) in enumerate(clips):
        inputs += ["-i", str(clip)]
        delay = int(start * 1000)
        filters.append(f"[{i}:a]aresample=48000,adelay={delay}|{delay}[v{i}]")
    mix = "".join(f"[v{i}]" for i in range(len(clips)))
    filters.append(f"{mix}amix=inputs={len(clips)}:normalize=0,apad,atrim=0:{DURATION},loudnorm=I=-16:TP=-1.5:LRA=11[out]")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(filters), "-map", "[out]", "-ac", "2", str(target)],
        check=True,
    )


def mux(video: Path, voice: Path, music: Path | None, target: Path) -> None:
    if music:
        graph = (
            f"[2:a]aresample=48000,volume=0.35,atrim=0:{DURATION},afade=t=out:st={DURATION - 1.5}:d=1.5[bed];"
            "[1:a]asplit=2[vo][key];"
            "[bed][key]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[ducked];"
            "[ducked][vo]amix=inputs=2:normalize=0[a]"
        )
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(video), "-i", str(voice), "-stream_loop", "-1", "-i", str(music),
               "-filter_complex", graph, "-map", "0:v", "-map", "[a]"]
    else:
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(video), "-i", str(voice), "-map", "0:v", "-map", "1:a"]
    cmd += ["-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", str(target)]
    subprocess.run(cmd, check=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--langs", default="en,pl")
    ap.add_argument("--name", default="Pointhours", help="nazwa produktu czytana przez lektora")
    ap.add_argument("--voice", default=None, help="voice_id ElevenLabs (nadpisuje voiceover.json)")
    ap.add_argument("--music", default=None, help="opcjonalny podkład muzyczny")
    ap.add_argument("--out", default=str(HERE / "out"))
    ap.add_argument("--dry-run", action="store_true", help="ton testowy zamiast API (sprawdza synchronizację i miks)")
    ap.add_argument("--list-voices", action="store_true")
    args = ap.parse_args()

    key = os.environ.get("ELEVENLABS_API_KEY")
    if args.list_voices:
        if not key:
            sys.exit("Ustaw ELEVENLABS_API_KEY.")
        voices = json.loads(api_request("/voices", key))["voices"]
        for v in voices:
            labels = ", ".join(f"{k}: {val}" for k, val in (v.get("labels") or {}).items())
            print(f"{v['voice_id']}  {v['name']:<20} {labels}")
        return
    if not key and not args.dry_run:
        sys.exit("Ustaw ELEVENLABS_API_KEY albo użyj --dry-run.")

    out = Path(args.out)
    work = out / "voice-work"
    work.mkdir(parents=True, exist_ok=True)
    script = json.loads(SCRIPT.read_text(encoding="utf-8"))
    music = Path(args.music) if args.music else None

    for lang in args.langs.split(","):
        spec = script[lang]
        segments = spec["segments"]
        voice = args.voice or spec["voice"]
        print(f"Lektor {lang} ({voice})…", flush=True)
        placed: list[tuple[Path, float]] = []
        cues: list[tuple[float, float, str]] = []
        for i, seg in enumerate(segments):
            text = seg["text"].replace("{name}", args.name)
            next_start = segments[i + 1]["start"] if i + 1 < len(segments) else DURATION - 0.3
            raw = work / f"{lang}-{i:02d}.mp3"
            synthesize(text, voice, key, raw, args.dry_run)
            clip, length = fit(raw, next_start - seg["start"] - 0.1, work)
            placed.append((clip, seg["start"]))
            cues.append((seg["start"], min(next_start, seg["start"] + length + 0.4), text))
        track = work / f"{lang}-voice.m4a"
        build_voice_track(placed, track)
        write_captions(cues, out / f"promo-{lang}")
        for fmt in FORMATS:
            video = out / f"promo-{lang}-{fmt}.mp4"
            if not video.exists():
                print(f"  - brak {video.name}, pomijam (najpierw render.py)")
                continue
            target = out / f"promo-{lang}-{fmt}-voice.mp4"
            mux(video, track, music, target)
            print(f"  ✓ {target.name}")


if __name__ == "__main__":
    main()
