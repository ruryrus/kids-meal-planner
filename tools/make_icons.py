#!/usr/bin/env python3
"""아이들 식단표 PWA 아이콘 생성기 (Pillow 전용, 외부 이미지/AI 미사용).

만들어지는 파일
  icons/icon-192.png          일반 런처 아이콘 (둥근 모서리, 투명 바깥)
  icons/icon-512.png          일반 런처 아이콘 (위와 같은 그림 512px)
  icons/icon-maskable-512.png 마스커블용 (배경 꽉 찬 사각 + 안전영역 안쪽에 그림)
  icons/favicon-64.png        브라우저 탭용

그림: 따뜻한 크림 배경 위에 밥그릇 + 고봉밥 + 젓가락 두 짝 + 하트.
4배 슈퍼샘플링 후 축소해 경계를 깔끔하게 만든다.
"""

from PIL import Image, ImageDraw, ImageFilter
import math, os

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")
SS = 4  # supersample


def vgrad(w, h, top, bottom):
    img = Image.new("RGB", (1, h))
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        px[0, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return img.resize((w, h))


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def draw_scene(size, inset=0.0, background="full"):
    """size x size 캔버스에 장면을 그린다.

    inset: 0.0~0.35. 그림 전체를 가운데로 줄여 여백을 만든다(마스커블 안전영역용).
    """
    S = size * SS
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # --- 배경 ---
    bg = vgrad(S, S, (255, 246, 233), (255, 214, 183)).convert("RGBA")
    if background == "rounded":
        bg.putalpha(rounded_mask(S, int(S * 0.22)))
    else:  # full bleed
        bg.putalpha(255)
    canvas.alpha_composite(bg)

    # 아주 옅은 원형 하이라이트
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([S * 0.12, S * 0.06, S * 0.88, S * 0.78], fill=(255, 255, 255, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.03))
    canvas.alpha_composite(glow)

    # --- 그림 레이어 (안전영역 맞춤) ---
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    scale = 1.0 - inset * 2
    cx = S / 2
    # 그릴 영역 기준 좌표 (0~1) -> 실제 픽셀
    def X(u):
        return cx + (u - 0.5) * S * scale

    def Y(v):
        return S / 2 + (v - 0.5) * S * scale

    def U(u):
        return u * S * scale

    # 그림자
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse([X(0.20), Y(0.76), X(0.80), Y(0.84)], fill=(150, 90, 55, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(S * 0.018))
    layer.alpha_composite(shadow)

    # 김 (밥 위 두 가닥)
    steam_col = (255, 255, 255, 175)
    for off in (-0.085, 0.085):
        pts = []
        for i in range(31):
            t = i / 30
            v = 0.30 - t * 0.17
            u = 0.50 + off + math.sin(t * math.pi * 1.6) * 0.022
            pts.append((X(u), Y(v)))
        d.line(pts, fill=steam_col, width=int(U(0.022)), joint="curve")

    # 밥그릇 몸통 (아래 반원)
    bowl_box = (X(0.19), Y(0.485), X(0.81), Y(0.845))
    d.pieslice(bowl_box, start=0, end=180, fill=(226, 99, 58, 255))
    # 아래쪽에 은은한 그늘
    shade = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    shd = ImageDraw.Draw(shade)
    shd.pieslice((X(0.19), Y(0.60), X(0.81), Y(0.845)), start=15, end=165,
                 fill=(140, 50, 22, 55))
    shade = shade.filter(ImageFilter.GaussianBlur(S * 0.013))
    layer.alpha_composite(shade)

    # 그릇 몸통 위 흰 장식 띠
    band = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    bd.arc((X(0.215), Y(0.545), X(0.785), Y(0.745)), start=8, end=172,
           fill=(255, 246, 233, 240), width=int(U(0.028)))
    layer.alpha_composite(band)

    # 그릇 입구 테두리
    d.ellipse((X(0.19), Y(0.445), X(0.81), Y(0.585)), fill=(255, 250, 243, 255))
    d.ellipse((X(0.222), Y(0.462), X(0.778), Y(0.568)), fill=(246, 235, 220, 255))

    # 고봉밥 (입구 안쪽에 봉긋하게)
    rice = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rice)
    rd.ellipse((X(0.245), Y(0.335), X(0.545), Y(0.545)), fill=(255, 253, 247, 255))
    rd.ellipse((X(0.455), Y(0.335), X(0.755), Y(0.545)), fill=(255, 253, 247, 255))
    rd.ellipse((X(0.305), Y(0.285), X(0.695), Y(0.505)), fill=(255, 253, 247, 255))
    layer.alpha_composite(rice)

    # 밥알 결 (옅은 점)
    for (u, v, r) in [(0.405, 0.385, 0.012), (0.475, 0.355, 0.011), (0.545, 0.395, 0.012),
                      (0.605, 0.375, 0.010), (0.375, 0.445, 0.010), (0.635, 0.435, 0.011),
                      (0.505, 0.445, 0.009), (0.445, 0.415, 0.009)]:
        d.ellipse((X(u - r), Y(v - r), X(u + r), Y(v + r)), fill=(238, 226, 210, 255))

    # 젓가락 두 짝 (오른쪽 위 대각선, 캔버스 안쪽)
    def chopstick(offset, color, width_u=0.030):
        a = (X(0.665 + offset), Y(0.640))
        b = (X(0.845 + offset), Y(0.205))
        d.line([a, b], fill=color, width=int(U(width_u)))
        r = U(width_u / 2)
        for p in (a, b):
            d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=color)

    chopstick(0.0, (150, 96, 58, 255))
    chopstick(0.055, (196, 133, 84, 255))

    # 포인트 하트 (왼쪽 위)
    hx, hy, hs = 0.165, 0.215, 0.062
    d.polygon([
        (X(hx), Y(hy + hs * 0.95)),
        (X(hx - hs * 0.95), Y(hy + hs * 0.05)),
        (X(hx - hs * 0.42), Y(hy - hs * 0.62)),
        (X(hx), Y(hy - hs * 0.18)),
        (X(hx + hs * 0.42), Y(hy - hs * 0.62)),
        (X(hx + hs * 0.95), Y(hy + hs * 0.05)),
    ], fill=(255, 122, 122, 255))

    canvas.alpha_composite(layer)
    return canvas.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    scene = draw_scene(512, inset=0.0, background="rounded")
    scene.save(os.path.join(OUT, "icon-512.png"), optimize=True)
    draw_scene(192, inset=0.0, background="rounded").save(
        os.path.join(OUT, "icon-192.png"), optimize=True)
    mask = draw_scene(512, inset=0.12, background="full")
    mask.save(os.path.join(OUT, "icon-maskable-512.png"), optimize=True)
    draw_scene(64, inset=0.0, background="rounded").save(
        os.path.join(OUT, "favicon-64.png"), optimize=True)
    print("written:", sorted(os.listdir(OUT)))


if __name__ == "__main__":
    main()
