"""Generate halftone portraits for everyone in content/people.

    python3 tools/portraits/build.py            # only new or changed photos/settings
    python3 tools/portraits/build.py --all      # regenerate everyone
    python3 tools/portraits/build.py serge-egelman   # just one person

Reads each person's `photo:` and optional `portrait:` settings, writes
public/portraits/<slug>.webp, and records what it used in
public/portraits/manifest.json so unchanged portraits are left alone.
Runs automatically in GitHub Actions (.github/workflows/portraits.yml)
whenever a photo or person file changes.
"""
import hashlib
import json
import os
import re
import sys

import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PEOPLE = os.path.join(ROOT, "content", "people")
OUT = os.path.join(ROOT, "public", "portraits")
MANIFEST = os.path.join(OUT, "manifest.json")
sys.path.insert(0, os.path.dirname(__file__))


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def front_matter(path: str) -> dict:
    text = open(path, encoding="utf-8").read().lstrip("﻿")
    m = re.match(r"^---\r?\n(.*?)\r?\n---", text, re.S)
    return (yaml.safe_load(m.group(1)) or {}) if m else {}


def main(argv):
    from portrait import PIPELINE_VERSION, make_portrait

    force = "--all" in argv
    only = {a for a in argv if not a.startswith("-")}
    manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    seen, made, problems = set(), [], []

    for f in sorted(os.listdir(PEOPLE)):
        if not f.endswith(".md") or f.startswith("_"):
            continue
        slug = slugify(f[:-3])
        seen.add(slug)
        if only and slug not in only:
            continue
        fm = front_matter(os.path.join(PEOPLE, f))
        photo = str(fm.get("photo") or "").strip().lstrip("/")
        if not photo:
            continue
        src = os.path.join(ROOT, photo)
        if not os.path.exists(src):
            problems.append(f"{f}: photo {photo} not found")
            continue
        settings = fm.get("portrait") or {}
        opts = {
            "zoom": float(settings.get("zoom", 1.0) or 1.0),
            "shift_x": float(settings.get("shift_x", 0.0) or 0.0),
            "background": str(settings.get("background", "auto") or "auto"),
        }
        key = hashlib.sha256(
            open(src, "rb").read() + json.dumps([PIPELINE_VERSION, opts], sort_keys=True).encode()
        ).hexdigest()
        dest = os.path.join(OUT, slug + ".webp")
        if not force and manifest.get(slug) == key and os.path.exists(dest):
            continue
        print(f"portrait: {slug} from {photo} {opts}", flush=True)
        make_portrait(src, dest, **opts)
        manifest[slug] = key
        made.append(slug)

    # remove portraits of people who no longer have a file
    for slug in list(manifest):
        if slug not in seen:
            path = os.path.join(OUT, slug + ".webp")
            if os.path.exists(path):
                os.remove(path)
            del manifest[slug]
            print(f"removed portrait for {slug}")

    os.makedirs(OUT, exist_ok=True)
    with open(MANIFEST, "w") as fh:
        json.dump(dict(sorted(manifest.items())), fh, indent=2)
        fh.write("\n")
    print(f"{len(made)} portrait(s) generated" + (f": {', '.join(made)}" if made else ""))
    for p in problems:
        print("WARNING:", p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
