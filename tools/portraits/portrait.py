"""Turn a headshot into the site's halftone portrait.

Steps (identical for every photo, so portraits always match):
  1. cut the person out of the background (U2-Net human segmentation)
  2. frame the head: same face width, same head-top position, centred
  3. even out the lighting, then render an ink halftone at display size

Per-person tweaks come from the `portrait:` block in content/people/<slug>.md:
  zoom:       1.0   bigger than 1 = closer crop
  shift_x:    0.0   move the face right (+) or left (-), as a fraction of the width
  background: auto  "fade" = no cut-out, soft head-and-shoulders fade (for busy backgrounds
                    the cut-out can't handle); "trim" = cut-out limited to a head-and-shoulders
                    shape (for backgrounds with strong vertical edges, like windows)
"""
from __future__ import annotations

import os
import urllib.request

import cv2
import numpy as np
from PIL import Image

PIPELINE_VERSION = "halftone-1"   # bump to force every portrait to be regenerated

# framing (fractions of the working canvas)
WORK = 1200
FACE_W = 0.52
FACE_CX = 0.5
HEAD_TOP = 0.07
# output
OUT_PX = 480          # shown at up to 240 CSS px, so 2x for sharp screens
CELL = 4.6            # halftone screen period in output pixels
ANGLE = 45
INK = (0x12, 0x16, 0x1D)

MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx"
MODEL_PATH = os.environ.get(
    "U2NET_MODEL", os.path.join(os.path.expanduser("~"), ".cache", "cse-portraits", "u2net_human_seg.onnx"))

_session = None


def _model():
    global _session
    if _session is None:
        import onnxruntime as ort
        if not os.path.exists(MODEL_PATH):
            os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
            print(f"downloading segmentation model to {MODEL_PATH} (176 MB, once)")
            urllib.request.urlretrieve(MODEL_URL, MODEL_PATH + ".part")
            os.replace(MODEL_PATH + ".part", MODEL_PATH)
        _session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
    return _session


def _segment(rgba: np.ndarray) -> np.ndarray:
    H, W = rgba.shape[:2]
    small = cv2.resize(rgba, (320, 320), interpolation=cv2.INTER_AREA)
    hole = (small[..., 3] < 250).astype(np.uint8)          # fill transparent corners (round crops)
    rgb = cv2.inpaint(np.ascontiguousarray(small[..., :3]), hole, 9, cv2.INPAINT_TELEA)
    x = rgb.astype(np.float32)
    x /= max(float(x.max()), 1e-6)
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    s = _model()
    d = s.run(None, {s.get_inputs()[0].name: x.transpose(2, 0, 1)[None].astype(np.float32)})[0][0, 0]
    d = (d - d.min()) / (d.max() - d.min() + 1e-8)
    return np.clip(cv2.resize(d, (W, H), interpolation=cv2.INTER_CUBIC), 0, 1)


def _bust(H: int, W: int, soft=0.06, hw=0.30, cx=0.5) -> np.ndarray:
    yy, xx = np.mgrid[:H, :W].astype(np.float32)
    head = ((xx - W * cx) / (W * hw)) ** 2 + ((yy - H * .40) / (H * .40)) ** 2
    m = np.clip((1.15 - head) / 0.3, 0, 1)
    body = (yy > H * .62) & (np.abs(xx - W * cx) < (W * .26 + (yy - H * .62) * 1.1))
    m = np.maximum(m, body.astype(np.float32))
    return cv2.GaussianBlur(m, (0, 0), W * soft)


def _face(rgb: np.ndarray, mask: np.ndarray):
    """(face centre x, face width, head top) estimated from skin pixels inside the person mask."""
    H, W = mask.shape
    m = mask > 0.5
    rows = np.where(m.sum(1) > W * 0.03)[0]
    head_top = rows[0] if len(rows) else int(H * 0.1)
    ycc = cv2.cvtColor(rgb, cv2.COLOR_RGB2YCrCb)
    skin = (ycc[..., 1] >= 133) & (ycc[..., 1] <= 180) & (ycc[..., 2] >= 77) & (ycc[..., 2] <= 135) & m
    k = max(3, W // 200) | 1
    skin = cv2.morphologyEx(skin.astype(np.uint8), cv2.MORPH_OPEN, np.ones((k, k), np.uint8))
    skin = cv2.morphologyEx(skin, cv2.MORPH_CLOSE, np.ones((3 * k, 3 * k), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(skin)
    if n <= 1:
        return W / 2, W * 0.35, head_top
    cands = [i for i in range(1, n) if stats[i, 1] < H * 0.6]
    i = max(cands or range(1, n), key=lambda q: stats[q, 4])
    comp = lab == i
    ys = np.where(comp.sum(1) > 0)[0]
    y_end = ys[0] + int((ys[-1] - ys[0]) * 0.55)
    band = comp.sum(1)[ys[0]:y_end]
    fw = float(np.percentile(band[band > 0], 90))
    cx = float(np.average(np.arange(W), weights=comp[ys[0]:y_end].sum(0) + 1e-9))
    return cx, fw, head_top


def cutout(path: str, zoom=1.0, shift_x=0.0, background="auto") -> np.ndarray:
    """RGBA float image (WORK x WORK): the person only, framed consistently."""
    a = np.asarray(Image.open(path).convert("RGBA"))
    H, W = a.shape[:2]
    alpha_src = a[..., 3].astype(np.float32) / 255
    rgb = np.ascontiguousarray(a[..., :3])
    if background == "fade":
        mask = _bust(H, W, soft=0.035, hw=0.27)
    elif background == "trim":
        seg = _segment(a) * alpha_src
        fcx, _, _ = _face(rgb, seg)
        mask = seg * _bust(H, W, soft=0.03, hw=0.36, cx=fcx / W)
    else:
        mask = _segment(a)
    mask *= alpha_src
    n, lab, st, _ = cv2.connectedComponentsWithStats((mask > 0.5).astype(np.uint8))
    if n > 2:                                   # keep only the main person blob
        keep = 1 + int(np.argmax(st[1:, 4]))
        mask *= cv2.dilate((lab == keep).astype(np.uint8), np.ones((9, 9), np.uint8)).astype(np.float32)
    cx, fw, top = _face(rgb, mask)
    scale = (FACE_W * WORK) / fw * float(zoom)
    M = np.float32([[scale, 0, (FACE_CX + float(shift_x)) * WORK - cx * scale],
                    [0, scale, HEAD_TOP * WORK - top * scale]])
    interp = cv2.INTER_CUBIC if scale > 1 else cv2.INTER_AREA
    rgb_o = cv2.warpAffine(rgb, M, (WORK, WORK), flags=interp, borderMode=cv2.BORDER_REPLICATE)
    m_o = cv2.warpAffine(mask, M, (WORK, WORK), flags=cv2.INTER_LINEAR, borderValue=0)
    alpha = np.clip(m_o, 0, 1)
    yy = np.linspace(0, 1, WORK)[:, None]
    alpha = alpha * np.clip((0.97 - yy) / 0.17, 0, 1)           # fade out the bottom of the bust
    return np.dstack([rgb_o.astype(np.float32) / 255, alpha])


def halftone(rgba: np.ndarray, size=OUT_PX, cell=CELL, angle=ANGLE) -> Image.Image:
    rgb = cv2.resize(rgba[..., :3], (size, size), interpolation=cv2.INTER_AREA)
    alpha = cv2.resize(rgba[..., 3], (size, size), interpolation=cv2.INTER_AREA)
    g = cv2.cvtColor((rgb * 255).astype(np.uint8), cv2.COLOR_RGB2LAB)[..., 0]
    g = cv2.createCLAHE(clipLimit=1.2, tileGridSize=(4, 4)).apply(g).astype(np.float32) / 255
    sel = alpha > 0.5
    lo, hi = np.percentile(g[sel], [1, 99.5])
    L = np.clip((g - lo) / (hi - lo + 1e-6), 0, 1)
    med = float(np.median(L[sel]))
    L = L ** float(np.clip(np.log(0.6) / np.log(max(med, 1e-3)), 0.4, 1.3))   # lift midtones
    L = cv2.bilateralFilter(L.astype(np.float32), 0, 0.08, 3)
    ss = 3                                                            # supersampled dot screen
    yy, xx = np.mgrid[:size * ss, :size * ss].astype(np.float32) / ss
    th = np.deg2rad(angle)
    u = xx * np.cos(th) + yy * np.sin(th)
    v = -xx * np.sin(th) + yy * np.cos(th)
    dist = np.sqrt(((u / cell) % 1 - 0.5) ** 2 + ((v / cell) % 1 - 0.5) ** 2)
    dark = cv2.resize(1 - L, (size * ss, size * ss), interpolation=cv2.INTER_LINEAR)
    r = np.sqrt(np.clip(dark, 0, 1) / np.pi) * 1.02
    ink = cv2.resize((dist < r).astype(np.float32), (size, size), interpolation=cv2.INTER_AREA)
    out = np.zeros((size, size, 4), np.uint8)
    out[..., :3] = INK
    out[..., 3] = np.clip(ink * alpha * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def make_portrait(photo: str, dest: str, zoom=1.0, shift_x=0.0, background="auto") -> None:
    img = halftone(cutout(photo, zoom=zoom, shift_x=shift_x, background=background))
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    img.save(dest, "WEBP", lossless=True, method=6)
