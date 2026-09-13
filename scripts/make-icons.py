"""Generate the PWA / favicon assets: a balance scale on the seal-green ground."""
import math
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "public")
SEAL = (14, 124, 102)
INK = (11, 15, 26)
WHITE = (255, 255, 255)


def draw_scale(d, S, colour=WHITE, pad=0.20):
    """A balance scale: column, beam, two pans, a base."""
    cx = S / 2
    lw = max(2, int(S * 0.045))
    top = S * pad
    bot = S * (1 - pad)

    # central column
    d.line([(cx, top + S * 0.10), (cx, bot - S * 0.06)], fill=colour, width=lw)
    # base
    d.line([(cx - S * 0.16, bot - S * 0.06), (cx + S * 0.16, bot - S * 0.06)], fill=colour, width=lw)
    d.line([(cx - S * 0.10, bot - S * 0.02), (cx + S * 0.10, bot - S * 0.02)], fill=colour, width=lw)
    # beam
    beam_y = top + S * 0.14
    arm = S * 0.24
    d.line([(cx - arm, beam_y), (cx + arm, beam_y)], fill=colour, width=lw)
    # finial
    r = S * 0.035
    d.ellipse([cx - r, top + S * 0.055 - r, cx + r, top + S * 0.055 + r], fill=colour)

    # pans: an arc open at the top, hung from each arm end
    pan_r = S * 0.13
    pan_y = beam_y + S * 0.20
    for sx in (cx - arm, cx + arm):
        d.line([(sx, beam_y), (sx, pan_y - pan_r * 0.15)], fill=colour, width=max(1, lw // 2))
        d.arc([sx - pan_r, pan_y - pan_r, sx + pan_r, pan_y + pan_r], start=0, end=180,
              fill=colour, width=lw)


def rounded(S, radius_ratio, bg):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(S * radius_ratio)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=bg)
    return img, d


def build(S, name, radius_ratio=0.22, pad=0.20, bg=SEAL):
    img, d = rounded(S, radius_ratio, bg)
    draw_scale(d, S, WHITE, pad)
    img.save(os.path.join(OUT, name))
    print("wrote", name, f"{S}x{S}")


os.makedirs(OUT, exist_ok=True)
build(192, "icon-192.png")
build(512, "icon-512.png")
# Maskable icons must survive a circular crop: keep the mark well inside.
build(512, "icon-maskable-512.png", radius_ratio=0.0, pad=0.30)
build(180, "apple-icon.png", radius_ratio=0.0)

# Favicon: a small multi-size ICO reads better than one scaled PNG.
ico, d = rounded(256, 0.18, SEAL)
draw_scale(d, 256, WHITE, 0.18)
ico.save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("wrote favicon.ico")

# Open Graph card for links shared on WhatsApp, which is how this would spread.
W, H = 1200, 630
og = Image.new("RGB", (W, H), (247, 248, 250))
d = ImageDraw.Draw(og)
d.rectangle([0, 0, W, 12], fill=SEAL)
badge, bd = rounded(200, 0.22, SEAL)
draw_scale(bd, 200, WHITE, 0.20)
og.paste(badge, (90, 150), badge)
try:
    from PIL import ImageFont
    f_big = ImageFont.truetype("arialbd.ttf", 74)
    f_sub = ImageFont.truetype("arial.ttf", 34)
    f_tag = ImageFont.truetype("arial.ttf", 27)
except Exception:
    f_big = f_sub = f_tag = None
d.text((330, 168), "e-Metrology", fill=INK, font=f_big)
d.text((334, 268), "Verify any weighing instrument in seconds", fill=(75, 85, 112), font=f_sub)
d.text((334, 322), "Legal Metrology Act, 2009  ·  tamper-evident QR certificate",
       fill=(75, 85, 112), font=f_tag)
og.save(os.path.join(OUT, "og.png"))
print("wrote og.png")
