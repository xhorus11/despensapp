# -*- coding: utf-8 -*-
"""DespensAPP · Video manual de uso (MP4 1080p con voz neutra y subtítulos).

Usa las capturas del manual (manual/img/*.webp, regenerables con `npm run shots`), narración con
edge-tts (voz neuronal es-US-PalomaNeural) y ffmpeg (imageio-ffmpeg). Los subtítulos van impresos en
la imagen y además como pista seleccionable (mov_text) y archivo .srt.

Uso:  python tools/video/make_video.py            (desde la raíz del proyecto)
Salida: video/DespensAPP-manual-de-uso.mp4 y video/DespensAPP-manual-de-uso.srt
Requisitos: pip install edge-tts imageio-ffmpeg brotli fonttools pillow
"""
import asyncio, hashlib, os, re, subprocess, sys, wave
from pathlib import Path

import edge_tts
import imageio_ffmpeg
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
IMG = ROOT / 'manual' / 'img'
OUT = ROOT / 'video'
WORK = Path(os.environ.get('VIDEO_WORK', ROOT / 'tools' / 'video' / '.work'))
VOICE = 'es-US-PalomaNeural'
RATE = '-4%'
FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H = 1920, 1080
GAP, SCENE_GAP = 0.35, 0.75          # silencios entre frases y entre escenas (s)

# Colores del tema claro "Huerto"
BG, SURF, LINE = (245, 246, 242), (255, 255, 255), (225, 229, 222)
TX, TX2, TX3 = (20, 33, 26), (62, 75, 67), (91, 104, 96)
BRAND, BRAND_SOFT, INK, SPARK = (30, 91, 58), (231, 242, 234), (20, 33, 26), (201, 138, 18)

# ---------------------------------------------------------------------------------------------
# Guion: (título, número/etiqueta, viñetas, capturas, frases). Una frase = un subtítulo.
# Una frase puede ser (texto_subtítulo, texto_hablado) cuando se lee distinto (p. ej. una URL).
# ---------------------------------------------------------------------------------------------
SCENES = [
    dict(kind='intro', title='Manual de uso', sentences=[
        'Bienvenido a DespensAPP, la aplicación para organizar la despensa, las compras, el menú y los gastos del hogar.',
        'En este video verás cómo funciona cada módulo y cómo te ayuda la inteligencia artificial.',
    ]),
    dict(title='Instalar la app', tag='1', shots=['21-instalar'], bullets=['Se abre desde el navegador', 'Botón verde Instalar', 'Funciona sin internet'], sentences=[
        ('DespensAPP se abre desde el navegador, en despensapp.web.app.', 'DespensAPP se abre desde el navegador, en despensapp punto web punto app.'),
        'Toca el botón verde Instalar y quedará en tu pantalla de inicio, como cualquier otra aplicación.',
        'En iPhone, usa Compartir y luego Agregar a pantalla de inicio.',
        'Una vez instalada, funciona incluso sin conexión.',
    ]),
    dict(title='Primeros pasos', tag='2', shots=['01-bienvenida'], bullets=['Nombre del hogar e integrantes', 'Presupuesto mensual', 'Entrar con Google para recuperar'], sentences=[
        'La primera vez, escribe el nombre de tu hogar, tu nombre y quiénes viven contigo.',
        'Define un presupuesto mensual y toca Empezar.',
        'Si ya usabas DespensAPP en otro teléfono, entra con Google para recuperar tus hogares.',
    ]),
    dict(title='Inicio', tag='3', shots=['02-inicio'], bullets=['Gasto del mes y presupuesto', 'Accesos rápidos', 'Alertas de vencimiento', 'Próximas comidas y bitácora'], sentences=[
        'La pantalla de Inicio resume tu día.',
        'Arriba ves cuánto has gastado este mes y cuánto te queda del presupuesto.',
        'Luego tienes accesos rápidos a la lista, la despensa y el modo súper.',
        'Las alertas avisan qué productos vencen pronto y qué está bajo el mínimo.',
        'Más abajo están las próximas comidas y la bitácora con lo que hizo cada integrante.',
    ]),
    dict(title='Despensa', tag='4', shots=['03-despensa', '04-despensa-editar'], bullets=['Todo lo que hay en casa', 'Semáforo de vencimiento', 'Stock mínimo', 'Se acabó: a la lista'], sentences=[
        'En Despensa está todo lo que hay en casa, ordenado por categoría.',
        'Cada producto muestra su cantidad y un semáforo de vencimiento: verde, amarillo o rojo.',
        'Con el botón menos descuentas una porción rápida.',
        'Al tocar un producto ajustas cantidades, fecha de vencimiento y stock mínimo.',
        'Si algo se acaba, lo envías a la lista con un toque.',
    ]),
    dict(title='Catálogo', tag='4', shots=['05-catalogo', '06-producto'], bullets=['Más de 330 productos', 'Supermercados chilenos', 'Variantes y unidades', 'Productos propios'], sentences=[
        'Para agregar, toca el botón más y busca en el catálogo de más de trescientos productos de supermercados chilenos.',
        'Elige la variante, la cantidad y la unidad.',
        'Si no encuentras algo, puedes crear tu propio producto.',
    ]),
    dict(title='Mi Lista', tag='5', shots=['07-lista'], bullets=['Desde el catálogo', 'Desde lo que falta en casa', 'Desde el menú de la semana'], sentences=[
        'En Mi Lista planificas la compra.',
        'Puedes agregar desde el catálogo, desde lo que falta en la despensa o desde el menú de la semana.',
        'Cada producto indica para qué receta es y si ya tienes algo en casa.',
    ]),
    dict(title='Modo En el Súper', tag='5', shots=['08-super', '09-precio'], bullets=['Precio real en el pasillo', 'Ofertas y descuentos', 'Precio por kilo', 'Termómetro del presupuesto'], sentences=[
        'Ya en el supermercado, activa el modo En el Súper.',
        'Al marcar un producto, anotas el precio real y aplicas ofertas, como dos por uno o descuentos.',
        'La app calcula el precio por kilo o por litro.',
        'El termómetro compara el carro con tu presupuesto en tiempo real.',
    ]),
    dict(title='Comparar y cerrar la compra', tag='5', shots=['10-comparador', '11-cerrar-compra'], bullets=['¿Qué formato conviene?', 'Todo pasa a la despensa', 'Se crea el gasto'], sentences=[
        'El comparador te dice qué formato conviene más, por kilo o por litro.',
        'Al cerrar la compra, los productos pasan solos a la despensa y se crea el gasto con todo el detalle.',
    ]),
    dict(title='Menú y recetario', tag='6', shots=['12-menu-semana', '13-recetario'], bullets=['Planifica la semana', '95 recetas', 'Ajuste por personas', 'Con lo que hay'], sentences=[
        'En Menú organizas las comidas de la semana.',
        'El recetario trae noventa y cinco recetas chilenas e internacionales, que se ajustan al número de personas.',
        'Con el filtro Con lo que hay, ves qué puedes cocinar sin comprar nada.',
    ]),
    dict(title='Recetas inteligentes', tag='6', shots=['14-receta', '16-agendar'], bullets=['Qué tienes y qué falta', 'Solo lo que falta a la lista', 'Cocinar descuenta de la despensa'], sentences=[
        'Cada receta muestra qué ingredientes tienes y cuáles faltan.',
        'Al agendarla, se envía a la lista solo lo que falta.',
        'Y cuando la cocinas, los ingredientes se descuentan de la despensa.',
    ]),
    dict(title='Dietas y salud', tag='7', shots=['20-integrante', '15-aviso-salud'], bullets=['Dietas y alergias', 'Condiciones de salud', 'Aviso antes de cocinar'], sentences=[
        'En Hogar registras las dietas, alergias y condiciones de salud de cada integrante, como celiaquía, hipertensión o diabetes.',
        'Antes de usar una receta, la app avisa si alguien no puede comerla, qué se adapta con una versión apta y qué requiere precaución.',
        'Estos avisos ayudan a organizarse, pero no reemplazan la indicación de un profesional de salud.',
    ]),
    dict(title='Gastos', tag='8', shots=['17-plata', '18-gasto'], bullets=['Presupuesto del mes', 'Gasto por categoría', 'Cuentas claras', 'Informe PDF y Excel'], sentences=[
        'En Gastos controlas el presupuesto del mes, el gasto por categoría y las cuentas claras entre integrantes.',
        'Para registrar un gasto, anotas el monto, la categoría, quién pagó y entre quiénes se reparte.',
        'Puedes adjuntar la boleta y exportar un informe en PDF o una planilla para Excel.',
    ]),
    dict(title='Cuentas separadas', tag='8', shots=['24-cuentas-separadas', '25-cuentas-separadas-resumen'], bullets=['Divide una boleta', 'Productos por persona', 'Quién aportó cuánto'], sentences=[
        'Con Cuentas separadas divides una boleta por persona.',
        'Asignas cada producto a quien lo consumió, agregas personas externas al hogar y registras quién aportó cuánto.',
        'El resumen muestra quién le debe a quién y actualiza las cuentas claras.',
    ]),
    dict(title='Boletas digitales', tag='8', shots=['33-boleta-digital', '34-boleta-pdf-visor'], bullets=['PDF y Word', 'Visor dentro de la app', 'Incluidas en el informe'], sentences=[
        'Si la boleta llegó por correo, adjúntala en PDF o en Word.',
        'Puedes verla dentro de la app, descargarla, y se incluye en el informe PDF.',
    ]),
    dict(kind='ai', title='Cómo funciona la inteligencia artificial', tag='IA', sentences=[
        'Ahora, la inteligencia artificial. DespensAPP la usa solo para leer y proponer, y siempre revisas antes de guardar.',
        'Cuando usas una función de IA, se envía solo esa foto o ese texto a un intermediario propio y seguro.',
        'Ese intermediario usa Gemini de Google y, como respaldo, un modelo de Cloudflare. La clave nunca está en tu teléfono.',
        'Los cálculos, como las cuentas, las dietas y la despensa, los hace siempre la app, no la IA.',
        'Cada persona tiene cuarenta usos de IA al día, y se pueden desactivar en Hogar.',
    ]),
    dict(title='Leer boleta con IA', tag='IA', shots=['26-ia-boleta'], bullets=['Foto, PDF o Word', 'Local, fecha, N° y total', 'Nombres legibles', '¿La suma cuadra?'], sentences=[
        'Para leer una boleta, toma una foto o adjunta el PDF.',
        'La IA anota el local, la fecha, el número, el total y cada producto, con nombres fáciles de entender.',
        'La app revisa si la suma cuadra con el total.',
        'Corriges lo que haga falta y, si quieres, pasas los productos directo a la despensa.',
    ]),
    dict(title='Inventario por foto', tag='IA', shots=['27-ia-despensa-opciones', '28-ia-inventario'], bullets=['Foto del refrigerador', 'Productos reconocidos', 'Dudosos desmarcados'], sentences=[
        'Desde la despensa también puedes sacarle una foto al refrigerador.',
        'La IA reconoce los productos que se ven y te propone el inventario. Los dudosos vienen desmarcados.',
    ]),
    dict(title='Lista escrita o dictada', tag='IA', shots=['29-ia-lista', '30-ia-lista-revisa'], bullets=['Habla con naturalidad', 'Corrígete al hablar', 'Dictar no gasta usos'], sentences=[
        'En Mi Lista, toca Escribir o dictar, y di lo que necesitas como se lo dirías a alguien.',
        'Si te equivocas, corrígete hablando. Por ejemplo: dos kilos de papas, no, mejor tres. La IA se queda con tu última decisión.',
        'Dictar no gasta usos; solo cuenta cada vez que conviertes la lista.',
    ]),
    dict(title='Chef IA', tag='IA', shots=['31-ia-chef', '32-ia-chef-receta'], bullets=['Usa lo que vence', 'Respeta dietas y salud', 'Se guarda en tu recetario'], sentences=[
        'El Chef IA propone una receta con lo que tienes, priorizando lo que está por vencer.',
        'Respeta las dietas y la salud de la casa, y al guardarla pasa por los mismos avisos que el resto del recetario.',
    ]),
    dict(title='Hogares compartidos', tag='9', shots=['19-hogar', '22-bitacora'], bullets=['Varios hogares', 'Código o QR para compartir', 'Cambios en tiempo real', 'Bitácora'], sentences=[
        'En Hogar administras los integrantes, y puedes tener varios hogares, cada uno con su propia despensa.',
        'Con un código o un QR compartes el hogar, y todos ven los cambios en tiempo real, con una bitácora de lo que hace cada uno.',
    ]),
    dict(title='Cuenta de Google', tag='10', shots=['38-cuenta-google', '39-cuenta-conectada'], bullets=['Opcional', 'Respaldo automático', 'No se pierde nada', 'Recupera en otro teléfono'], sentences=[
        'Conecta tu cuenta de Google en Hogar para respaldar tus datos automáticamente.',
        'Es opcional y no se pierde nada de lo que ya tenías.',
        'En un teléfono nuevo, entras con Google y recuperas tus hogares.',
    ]),
    dict(title='Apariencia', tag='11', shots=['35-apariencia', '36-modo-oscuro'], bullets=['Claro', 'Oscuro', 'Automático'], sentences=[
        'Finalmente, en Apariencia eliges entre el modo claro, el oscuro o el automático, que sigue la configuración de tu teléfono.',
    ]),
    dict(kind='outro', title='DespensAPP', sentences=[
        'Eso es DespensAPP: tu despensa, tus compras, tu menú y tus gastos, conectados.',
        ('Encuentra el manual completo en despensapp.web.app/manual', 'Encuentra el manual completo en despensapp punto web punto app, barra manual.'),
    ]),
]


# ---------------------------------------------------------------------------------------------
def font_files():
    """Convierte la tipografía de la app (woff2 variable) a TTF para Pillow."""
    WORK.mkdir(parents=True, exist_ok=True)
    ttf = WORK / 'PlusJakartaSans.ttf'
    if not ttf.exists():
        f = TTFont(ROOT / 'vendor' / 'fonts' / 'plus-jakarta-sans-latin.woff2')
        f.flavor = None
        f.save(ttf)
    return ttf


TTF = None
def font(size, weight=500):
    f = ImageFont.truetype(str(TTF), size)
    try: f.set_variation_by_axes([weight])
    except Exception: pass
    return f


def wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=fnt) <= max_w: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines


def rounded(draw, box, r, fill, outline=None, width=1):
    draw.rounded_rectangle(box, r, fill=fill, outline=outline, width=width)


def phone(shot, height):
    """Captura dentro de un marco de teléfono oscuro."""
    im = Image.open(IMG / f'{shot}.webp').convert('RGB')
    pad = 14
    w = round(im.width * (height - 2 * pad) / im.height)
    im = im.resize((w, height - 2 * pad), Image.LANCZOS)
    fr = Image.new('RGBA', (w + 2 * pad, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(fr)
    d.rounded_rectangle((0, 0, fr.width - 1, fr.height - 1), 52, fill=INK + (255,))
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), 40, fill=255)
    fr.paste(im, (pad, pad), mask)
    return fr


def shadow_paste(base, img, xy):
    m = 70                                   # margen para que el desenfoque no se corte
    sh = Image.new('RGBA', (img.width + 2 * m, img.height + 2 * m), (20, 33, 26, 0))
    ImageDraw.Draw(sh).rounded_rectangle((m, m, m + img.width - 1, m + img.height - 1), 52, fill=(20, 33, 26, 60))
    from PIL import ImageFilter
    sh = sh.filter(ImageFilter.GaussianBlur(22))
    base.alpha_composite(sh, (xy[0] - m, xy[1] + 18 - m))
    base.alpha_composite(img, xy)


def header(base, d):
    logo = Image.open(ROOT / 'img' / 'logo-256.png').convert('RGBA').resize((76, 76), Image.LANCZOS)
    base.alpha_composite(logo, (96, 44))
    d.text((186, 60), 'DespensAPP', font=font(30, 800), fill=TX)
    d.text((186, 96), 'Manual de uso', font=font(20, 500), fill=TX3)


def scene_base(sc, n_scene, total):
    base = Image.new('RGBA', (W, H), BG + (255,))
    d = ImageDraw.Draw(base)
    kind = sc.get('kind')
    if kind in ('intro', 'outro'):
        logo = Image.open(ROOT / 'img' / 'logo.png').convert('RGBA').resize((520, 520), Image.LANCZOS)
        base.alpha_composite(logo, ((W - 520) // 2, 110))
        t = sc['title'] if kind == 'intro' else 'Despensa, compras, menú y gastos del hogar'
        f = font(64 if kind == 'intro' else 46, 800)
        d.text(((W - d.textlength(t, font=f)) / 2, 660), t, font=f, fill=TX)
        sub = 'Cómo funciona la plataforma, módulo por módulo' if kind == 'intro' else 'despensapp.web.app'
        f2 = font(32, 500)
        d.text(((W - d.textlength(sub, font=f2)) / 2, 750), sub, font=f2, fill=BRAND if kind == 'outro' else TX3)
        return base
    header(base, d)
    # Barra de progreso del video
    d.rounded_rectangle((W - 420, 72, W - 96, 80), 4, fill=LINE)
    d.rounded_rectangle((W - 420, 72, W - 420 + round(324 * n_scene / total), 80), 4, fill=BRAND)
    # Etiqueta y título
    tag = sc.get('tag', '')
    is_ai = tag == 'IA'
    tf = font(30, 800)
    tw = d.textlength(tag, font=tf)
    rounded(d, (110, 210, 110 + max(64, tw + 36), 274), 18, INK if is_ai else BRAND)
    d.text((110 + (max(64, tw + 36) - tw) / 2, 222), tag, font=tf, fill=SPARK if is_ai else (255, 255, 255))
    title_lines = wrap(d, sc['title'], font(64, 800), 820)
    y = 300
    for ln in title_lines:
        d.text((110, y), ln, font=font(64, 800), fill=TX); y += 78
    y += 22
    if kind == 'ai':
        steps = [('1', 'Foto o texto', 'Solo lo que eliges enviar'), ('2', 'Intermediario seguro', 'Gemini + respaldo Cloudflare'),
                 ('3', 'Tú revisas', 'Nada se guarda sin confirmar'), ('4', 'La app calcula', 'Cuentas, dietas y despensa')]
        x0, bw, gap = 110, 400, 28
        for i, (n, t1, t2) in enumerate(steps):
            col, row = i % 2, i // 2
            bx, by = x0 + col * (bw + gap), y + row * 190
            rounded(d, (bx, by, bx + bw, by + 160), 26, SURF, LINE, 2)
            rounded(d, (bx + 24, by + 24, bx + 76, by + 76), 16, INK)
            d.text((bx + 50 - d.textlength(n, font=font(28, 800)) / 2, by + 32), n, font=font(28, 800), fill=SPARK)
            d.text((bx + 24, by + 90), t1, font=font(30, 800), fill=TX)
            d.text((bx + 24, by + 126), t2, font=font(22, 500), fill=TX3)
        # Ilustración: logo grande a la derecha
        logo = Image.open(ROOT / 'img' / 'logo.png').convert('RGBA').resize((560, 560), Image.LANCZOS)
        base.alpha_composite(logo, (1200, 230))
        return base
    for b in sc.get('bullets', []):
        rounded(d, (112, y + 14, 128, y + 30), 6, BRAND)
        for i, ln in enumerate(wrap(d, b, font(36, 600), 760)):
            d.text((150, y + i * 46), ln, font=font(36, 600), fill=TX2)
        y += 46 * len(wrap(d, b, font(36, 600), 760)) + 26
    # Teléfonos a la derecha
    shots = sc.get('shots', [])
    ph = 720
    phones = [phone(s, ph) for s in shots]
    total_w = sum(p.width for p in phones) + 56 * (len(phones) - 1)
    x = W - 110 - total_w
    if len(phones) == 1: x = 1300 - phones[0].width // 2 + 120
    for p in phones:
        shadow_paste(base, p, (x, 140))
        x += p.width + 56
    return base


def with_subtitle(base, text):
    im = base.copy()
    d = ImageDraw.Draw(im)
    f = font(40, 600)
    lines = wrap(d, text, f, 1560)
    lh = 54
    bh = lh * len(lines) + 36
    y0 = H - 40 - bh
    bw = max(d.textlength(ln, font=f) for ln in lines) + 72
    x0 = (W - bw) / 2
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(ov).rounded_rectangle((x0, y0, x0 + bw, y0 + bh), 24, fill=(20, 33, 26, 232))
    im.alpha_composite(ov)
    for i, ln in enumerate(lines):
        d.text(((W - d.textlength(ln, font=f)) / 2, y0 + 18 + i * lh), ln, font=f, fill=(255, 255, 255))
    return im.convert('RGB')


# ---------------------------------------------------------------------------------------------
async def tts(text, path):
    if path.exists() and path.stat().st_size > 1000: return
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(path))
            return
        except Exception as e:
            print('  reintento voz:', e); await asyncio.sleep(2 + attempt * 2)
    raise RuntimeError('No se pudo generar la voz')


def to_wav(mp3, wav):
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', str(mp3), '-ar', '24000', '-ac', '1', '-sample_fmt', 's16', str(wav)], check=True)
    with wave.open(str(wav)) as w: return w.getnframes() / w.getframerate()


def srt_time(t):
    ms = round(t * 1000); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'


async def main():
    global TTF
    TTF = font_files()
    (WORK / 'voz').mkdir(parents=True, exist_ok=True)
    (WORK / 'frames').mkdir(parents=True, exist_ok=True)
    OUT.mkdir(exist_ok=True)
    items = []        # (frame_path, duration, subtitle, start)
    audio = bytearray()
    t = 0.0
    silence = lambda s: b'\x00\x00' * round(24000 * s)
    total = len(SCENES)
    for si, sc in enumerate(SCENES):
        print(f'[{si + 1}/{total}] {sc["title"]}')
        base = scene_base(sc, si + 1, total)
        for k, s in enumerate(sc['sentences']):
            sub, speak = (s if isinstance(s, tuple) else (s, s))
            key = hashlib.sha1(f'{VOICE}|{RATE}|{speak}'.encode()).hexdigest()[:16]
            mp3, wav = WORK / 'voz' / f'{key}.mp3', WORK / 'voz' / f'{key}.wav'
            await tts(speak, mp3)
            dur = to_wav(mp3, wav)
            with wave.open(str(wav)) as w: audio += w.readframes(w.getnframes())
            pause = SCENE_GAP if k == len(sc['sentences']) - 1 else GAP
            audio += silence(pause)
            frame = WORK / 'frames' / f'{si:02}_{k:02}.png'
            with_subtitle(base, sub).save(frame, optimize=False, compress_level=1)
            items.append((frame, dur + pause, sub, t, dur))
            t += dur + pause
    # Audio completo
    wav_all = WORK / 'narracion.wav'
    with wave.open(str(wav_all), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(bytes(audio))
    # Lista de imágenes con su duración (concat demuxer)
    lst = WORK / 'frames.txt'
    with open(lst, 'w', encoding='utf8') as f:
        for fr, dur, *_ in items:
            f.write(f"file '{fr.as_posix()}'\nduration {dur:.3f}\n")
        f.write(f"file '{items[-1][0].as_posix()}'\n")
    # Subtítulos .srt
    srt = OUT / 'DespensAPP-manual-de-uso.srt'
    with open(srt, 'w', encoding='utf8') as f:
        for i, (_, _, sub, start, dur) in enumerate(items, 1):
            f.write(f'{i}\n{srt_time(start)} --> {srt_time(start + dur + 0.15)}\n{sub}\n\n')
    out = OUT / 'DespensAPP-manual-de-uso.mp4'
    print(f'Montando video ({t / 60:.1f} min)…')
    subprocess.run([FF, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(lst), '-i', str(wav_all), '-i', str(srt),
                    '-map', '0:v', '-map', '1:a', '-map', '2:s',
                    '-vf', f'fps=30,format=yuv420p,fade=t=in:st=0:d=0.6,fade=t=out:st={t - 0.9:.2f}:d=0.9',
                    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-tune', 'stillimage',
                    '-c:a', 'aac', '-b:a', '160k', '-af', f'afade=t=in:st=0:d=0.4,afade=t=out:st={t - 0.9:.2f}:d=0.9',
                    '-c:s', 'mov_text', '-metadata:s:s:0', 'language=spa', '-metadata:s:s:0', 'title=Español',
                    '-metadata', 'title=DespensAPP · Manual de uso', '-movflags', '+faststart', '-shortest', str(out)], check=True)
    print(f'Listo: {out} ({out.stat().st_size / 1e6:.1f} MB, {t / 60:.1f} min, {len(items)} subtítulos)')


if __name__ == '__main__':
    asyncio.run(main())
