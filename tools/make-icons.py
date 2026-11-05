#!/usr/bin/env python3
"""
Generate every static brand asset for the site:

  * favicons (svg / ico / png)
  * PWA icons, including dedicated maskable variants
  * Apple touch icon + launch (splash) images
  * Open Graph / Twitter card
  * manifest screenshots
  * per-line shortcut icons

Everything is drawn from the same HMR mark used in the UI, so the browser tab,
the installed app and a shared link all read as the same product. Re-run with
`python3 tools/make-icons.py` after changing the mark.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "icons"
SPLASH = OUT / "splash"
OUT.mkdir(parents=True, exist_ok=True)
SPLASH.mkdir(parents=True, exist_ok=True)

INK = "#eef2f3"
GREEN = "#0aa06a"
BLUE = "#007abb"
RED = "#e31e24"
BG_TOP = (15, 23, 28)
BG_BOTTOM = (4, 8, 10)

SS = 4  # supersampling for the small raster assets


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size):
    """Diagonal background plus a soft blue glow behind the mark."""
    w = h = size
    base = Image.new("RGB", (w, h), BG_BOTTOM)
    px = base.load()
    for y in range(h):
        row = lerp(BG_TOP, BG_BOTTOM, (y / max(1, h - 1)) ** 0.9)
        for x in range(w):
            # very slight horizontal shift so the top-left is a touch warmer
            t = (x / max(1, w - 1)) * 0.18
            px[x, y] = lerp(row, BG_BOTTOM, t)
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    r = int(size * 0.46)
    cx, cy = int(size * 0.5), int(size * 0.44)
    for i in range(18, 0, -1):
        rr = int(r * i / 18)
        a = int(20 * (1 - i / 18) ** 1.7)
        g.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(18, 74, 104, a))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.05))
    base = Image.alpha_composite(base.convert("RGBA"), glow)
    return base


def draw_mark(img, cx, cy, R, tiny=False, ring=True):
    """Ring, metro H and the green corridor sweep, all centred on (cx, cy)."""
    d = ImageDraw.Draw(img)
    ring_w = max(1.0, R * (0.085 if not tiny else 0.15))
    if ring:
        d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=INK, width=round(ring_w))

    bar_w = max(1.4, R * (0.135 if not tiny else 0.24))
    half = R * (0.40 if not tiny else 0.36)
    top = cy - R * (0.36 if not tiny else 0.30)
    bottom = cy + R * (0.36 if not tiny else 0.30)
    radius = bar_w / 2
    for sx in (-1, 1):
        x = cx + sx * half
        d.rounded_rectangle(
            [x - bar_w / 2, top, x + bar_w / 2, bottom],
            radius=radius,
            fill=INK,
        )
    cross_h = bar_w * (1.0 if not tiny else 1.1)
    d.rounded_rectangle(
        [cx - half, cy - cross_h / 2, cx + half, cy + cross_h / 2],
        radius=cross_h / 2,
        fill=INK,
    )

    # The green swoosh follows the upper-right of the ring: start just left of
    # top, sweep to the 2 o'clock position.
    sr = R * 0.69
    swoosh = max(1.2, R * (0.105 if not tiny else 0.18))
    box = [cx - sr, cy - sr, cx + sr, cy + sr]
    d.arc(box, start=-96, end=-18, fill=GREEN, width=round(swoosh))


def make_icon(size, tiny=False, padding=0.0, background=True):
    n = size * SS
    img = gradient(n) if background else Image.new("RGBA", (n, n), (0, 0, 0, 0))
    R = n * (0.29 - padding)
    draw_mark(img, n / 2, n / 2, R, tiny=tiny)
    return img.resize((size, size), Image.LANCZOS)


def rounded(img, radius_ratio=0.22):
    n = img.size[0]
    mask = Image.new("L", (n, n), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, n - 1, n - 1], radius=n * radius_ratio, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def save(img, name, **kw):
    path = OUT / name
    img.save(path, **kw)
    print("wrote", path.relative_to(ROOT), img.size)


# ---------------------------------------------------------------------------
# Favicons
# ---------------------------------------------------------------------------
save(rounded(make_icon(64), 0.24), "favicon-64.png")
save(make_icon(16, tiny=True), "favicon-16x16.png")
save(make_icon(32, tiny=True), "favicon-32x32.png")
save(make_icon(48, tiny=True), "favicon-48x48.png")
save(make_icon(180), "apple-touch-icon.png")
save(make_icon(150), "mstile-150x150.png")

ico = make_icon(256, tiny=True)
ico.save(
    OUT / "favicon.ico",
    sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print("wrote", (OUT / "favicon.ico").relative_to(ROOT))

# ---------------------------------------------------------------------------
# PWA icons
# ---------------------------------------------------------------------------
for s in (192, 256, 384, 512, 1024):
    save(make_icon(s), f"icon-{s}.png")
for s in (192, 512):
    # Extra padding keeps the mark inside the maskable safe zone on Android.
    save(make_icon(s, padding=0.045), f"maskable-{s}.png")

# Line shortcut icons: same mark, line-coloured ring accent.
for line, colour in (("red", RED), ("green", GREEN), ("blue", BLUE)):
    size = 192
    n = size * SS
    img = gradient(n)
    d = ImageDraw.Draw(img)
    R = n * 0.29
    d.ellipse([n / 2 - R, n / 2 - R, n / 2 + R, n / 2 + R], outline=colour, width=round(R * 0.13))
    draw_mark(img, n / 2, n / 2, R * 0.80, ring=False)
    img = img.resize((size, size), Image.LANCZOS)
    save(img, f"shortcut-{line}-192.png")

# ---------------------------------------------------------------------------
# SVG favicon + Safari pinned tab
# ---------------------------------------------------------------------------
favicon_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f171c"/>
      <stop offset="1" stop-color="#04080a"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="15" fill="url(#g)"/>
  <circle cx="32" cy="32" r="17.5" fill="none" stroke="#eef2f3" stroke-width="1.9"/>
  <path d="M26.4 25.4v13.2M37.6 25.4v13.2M26.4 32h11.2" fill="none" stroke="#eef2f3" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M31.2 20.4a12.1 12.1 0 0 1 11.6 7.1" fill="none" stroke="#0aa06a" stroke-width="1.85" stroke-linecap="round"/>
</svg>
"""
(OUT / "favicon.svg").write_text(favicon_svg)
print("wrote", (OUT / "favicon.svg").relative_to(ROOT))

pinned_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="27" fill="none" stroke="#000" stroke-width="2.6"/>
  <path d="M24.5 22.5v19M39.5 22.5v19M24.5 32h15" fill="none" stroke="#000" stroke-width="4" stroke-linecap="round"/>
  <path d="M31 14.6c7.7 0 14.4 4.4 17.8 10.8" fill="none" stroke="#000" stroke-width="2.8" stroke-linecap="round"/>
</svg>
"""
(OUT / "safari-pinned-tab.svg").write_text(pinned_svg)
print("wrote", (OUT / "safari-pinned-tab.svg").relative_to(ROOT))

# ---------------------------------------------------------------------------
# Type helpers
# ---------------------------------------------------------------------------
HELV = "/System/Library/Fonts/HelveticaNeue.ttc"
MONO = "/System/Library/Fonts/Menlo.ttc"


def font(path, size, index=0):
    return ImageFont.truetype(path, size, index=index)


def tracked(draw, xy, text, fnt, fill, tracking=0.0, anchor=None):
    """Draw text with explicit letter spacing; returns the end x."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill, anchor=anchor)
        w = draw.textlength(ch, font=fnt)
        x += w + tracking
    return x


def cover(path, size):
    im = Image.open(path).convert("RGB")
    tw, th = size
    s = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    left = (im.width - tw) // 2
    top = (im.height - th) // 2
    return im.crop((left, top, left + tw, top + th))


def vertical_gradient(size, top_alpha, bottom_alpha):
    w, h = size
    g = Image.new("RGBA", (w, h))
    d = ImageDraw.Draw(g)
    for y in range(h):
        t = y / max(1, h - 1)
        a = round(top_alpha + (bottom_alpha - top_alpha) * t)
        d.line([(0, y), (w, y)], fill=(2, 5, 7, a))
    return g


# ---------------------------------------------------------------------------
# Open Graph card (1200x630)
# ---------------------------------------------------------------------------
OG_W, OG_H = 1200, 630
og = cover(ROOT / "assets/readme/hero-day.jpg", (OG_W, OG_H)).convert("RGBA")
og = Image.alpha_composite(og, Image.new("RGBA", (OG_W, OG_H), (2, 5, 7, 70)))
# left-side scrim so the type always sits on a quiet field
scrim = Image.new("RGBA", (OG_W, OG_H), (0, 0, 0, 0))
sd = ImageDraw.Draw(scrim)
for x in range(OG_W):
    t = min(1.0, max(0.0, (x - 300) / 620))
    a = round(238 * (1 - t) ** 1.15)
    sd.line([(x, 0), (x, OG_H)], fill=(3, 7, 9, a))
og = Image.alpha_composite(og, scrim)
og = Image.alpha_composite(og, vertical_gradient((OG_W, OG_H), 80, 120))

mark = make_icon(76, background=False)
og.paste(mark, (76, 58), mark)

d = ImageDraw.Draw(og)
f_eyebrow = font(MONO, 15, 0)
f_title = font(HELV, 92, 1)
f_title_light = font(HELV, 92, 0)
f_sub = font(MONO, 17, 0)
f_small = font(MONO, 13, 0)

tracked(d, (76, 148), "HYDERABAD METRO RAIL  ·  LIVE 3D TRACKER", f_eyebrow, (178, 199, 203), 2.6)
d.text((72, 172), "Metro", font=f_title, fill=(244, 248, 249))
w_metro = d.textlength("Metro", font=f_title)
d.text((72 + w_metro + 8, 172), "live", font=f_title_light, fill=(196, 208, 211))
tracked(d, (76, 300), "RED / GREEN / BLUE", f_sub, (238, 243, 244), 3.2)
tracked(d, (76, 330), "64.6 KM  ·  57 STATIONS  ·  162 SETS", f_small, (150, 169, 173), 2.2)

# line badges
bx = 76
for label, colour in (("RED", RED), ("GREEN", GREEN), ("BLUE", BLUE)):
    bw = 70
    d.rounded_rectangle([bx, 384, bx + bw, 410], radius=4, fill=colour)
    lw = d.textlength(label, font=f_small)
    d.text((bx + (bw - lw) / 2, 389), label, font=f_small, fill="white")
    bx += bw + 9

tracked(d, (76, 536), "OFFICIAL HMRL GTFS  ·  JULY 2026", f_small, (136, 156, 160), 2.0)
url = "abhinav-prabhakar.github.io/ProjectMetro"
uw = d.textlength(url, font=f_small)
d.text((OG_W - 76 - uw, 536), url, font=f_small, fill=(196, 210, 213))

og.convert("RGB").save(OUT / "og-image.jpg", quality=91, optimize=True, progressive=True)
print("wrote", (OUT / "og-image.jpg").relative_to(ROOT), og.size)

# Twitter uses the same card; keep a square-ish crop for summary cards.
tw = Image.open(OUT / "og-image.jpg").convert("RGB").crop((0, 0, 630, 630))
tw.save(OUT / "twitter-image.jpg", quality=90, optimize=True, progressive=True)
print("wrote", (OUT / "twitter-image.jpg").relative_to(ROOT), tw.size)

# ---------------------------------------------------------------------------
# Manifest screenshots (real app captures, cropped to store sizes)
# ---------------------------------------------------------------------------
cover(ROOT / "assets/readme/hero-day.jpg", (1280, 720)).save(
    OUT / "screenshot-wide.jpg", quality=86, optimize=True, progressive=True
)
print("wrote", (OUT / "screenshot-wide.jpg").relative_to(ROOT))
cover(ROOT / "assets/readme/hero-night.jpg", (720, 1280)).save(
    OUT / "screenshot-narrow.jpg", quality=86, optimize=True, progressive=True
)
print("wrote", (OUT / "screenshot-narrow.jpg").relative_to(ROOT))

# ---------------------------------------------------------------------------
# Apple launch images
# ---------------------------------------------------------------------------
SPLASH_SIZES = [
    (1320, 2868), (1206, 2622), (1290, 2796), (1179, 2556),
    (1284, 2778), (1170, 2532), (1242, 2688), (1125, 2436),
    (828, 1792), (750, 1334),
    (2048, 2732), (1668, 2388), (1640, 2360), (1620, 2160),
    (1536, 2048), (1488, 2266),
]

f_splash = font(HELV, 34, 1)
f_splash_sub = font(MONO, 13, 0)

for w, h in SPLASH_SIZES:
    for name_w, name_h, orientation in ((w, h, "portrait"), (h, w, "landscape")):
        im = Image.new("RGB", (name_w, name_h), BG_BOTTOM)
        # faint glow so the launch screen does not read as a dead black rectangle
        glow = Image.new("RGBA", (name_w, name_h), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gr = int(min(name_w, name_h) * 0.34)
        gd.ellipse(
            [name_w / 2 - gr, name_h * 0.42 - gr, name_w / 2 + gr, name_h * 0.42 + gr],
            fill=(16, 62, 86, 34),
        )
        glow = glow.filter(ImageFilter.GaussianBlur(min(name_w, name_h) * 0.12))
        im = Image.alpha_composite(im.convert("RGBA"), glow).convert("RGB")

        R = int(min(name_w, name_h) * 0.10)
        mark = Image.new("RGBA", (R * 2 + 40, R * 2 + 40), (0, 0, 0, 0))
        draw_mark(mark, mark.width / 2, mark.height / 2, R)
        im.paste(mark, (int(name_w / 2 - mark.width / 2), int(name_h * 0.42 - mark.height / 2)), mark)

        dd = ImageDraw.Draw(im)
        label = "HYDERABAD METRO"
        lw = dd.textlength(label, font=f_splash)
        dd.text((name_w / 2 - lw / 2, name_h * 0.42 + R + 40), label, font=f_splash, fill=(238, 242, 243))
        sub = "LIVE 3D NETWORK TRACKER"
        sw = 0
        for ch in sub:
            sw += dd.textlength(ch, font=f_splash_sub) + 3.4
        tracked(dd, (name_w / 2 - sw / 2, name_h * 0.42 + R + 88), sub, f_splash_sub, (120, 140, 145), 3.4)

        name = f"splash-{orientation}-{name_w}x{name_h}.jpg"
        im.save(SPLASH / name, quality=82, optimize=True, progressive=True)

print(f"wrote {len(SPLASH_SIZES) * 2} splash images to", SPLASH.relative_to(ROOT))
