from PIL import Image, ImageDraw
import os

SRC = 'checkin/emblem.png'
RES = 'android/app/src/main/res'
NAVY = (15, 27, 46, 255)      # #0F1B2E  アプリの下地色
CREAM = (242, 232, 213)       # #F2E8D5  エンブレムの描画色

em = Image.open(SRC).convert('RGBA')
em = em.crop(em.getchannel('A').getbbox())   # 余白を除去

# 細い線が小サイズで消えないよう、不透明度を持ち上げてクリーム色で塗り直す
a = em.getchannel('A').point(lambda v: min(255, int(v * 1.7)))
mark = Image.new('RGBA', em.size, CREAM + (0,))
mark.putalpha(a)

def scaled(width):
    h = max(1, round(mark.height * width / mark.width))
    return mark.resize((width, h), Image.LANCZOS)

def place(canvas, ratio):
    """canvas の幅に対し ratio の比率でエンブレムを中央配置"""
    w = max(1, round(canvas.width * ratio))
    m = scaled(w)
    canvas.alpha_composite(m, ((canvas.width - m.width)//2, (canvas.height - m.height)//2))
    return canvas

def save(img, folder, name):
    d = os.path.join(RES, folder)
    os.makedirs(d, exist_ok=True)
    img.save(os.path.join(d, name + '.png'))

# ── アダプティブアイコンの前景（API 26+）──────────────────────
# 108dp のうち中央 72dp が確実に表示される安全領域。0.58 で収まる。
for folder, size in [('mipmap-mdpi',108), ('mipmap-hdpi',162), ('mipmap-xhdpi',216),
                     ('mipmap-xxhdpi',324), ('mipmap-xxxhdpi',432)]:
    fg = Image.new('RGBA', (size, size), (0,0,0,0))
    save(place(fg, 0.64), folder, 'ic_launcher_foreground')

# ── 旧形式アイコン（API 24〜25 用のフォールバック）──────────────
for folder, size in [('mipmap-mdpi',48), ('mipmap-hdpi',72), ('mipmap-xhdpi',96),
                     ('mipmap-xxhdpi',144), ('mipmap-xxxhdpi',192)]:
    # 角丸四角
    sq = Image.new('RGBA', (size, size), (0,0,0,0))
    d = ImageDraw.Draw(sq)
    d.rounded_rectangle([0,0,size-1,size-1], radius=round(size*0.22), fill=NAVY)
    save(place(sq, 0.74), folder, 'ic_launcher')
    # 円形
    ci = Image.new('RGBA', (size, size), (0,0,0,0))
    d = ImageDraw.Draw(ci)
    d.ellipse([0,0,size-1,size-1], fill=NAVY)
    save(place(ci, 0.66), folder, 'ic_launcher_round')

print('done')
