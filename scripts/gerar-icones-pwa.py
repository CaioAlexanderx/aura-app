#!/usr/bin/env python3
# ============================================================
# AURA. — gera os ícones do PWA a partir de assets/Icon.png
#
# Criado: 22/09/2026 (PWA Fase 1)
#
#   python3 scripts/gerar-icones-pwa.py
#
# Precisa do Pillow (`pip install pillow`). É um passo manual, rodado
# quando a logo muda; os PNGs gerados ficam versionados em public/ e o
# teste __tests__/pwaManifest.test.ts confere tamanho e presença.
#
# Por que três arquivos e não um:
#
#   aura-icone-512.png           "any"      — a logo inteira, do jeito que
#                                             é. O Android mostra num
#                                             fundo próprio quando não há
#                                             versão maskable.
#   aura-icone-512-maskable.png  "maskable" — a logo a 72% sobre fundo
#                                             sólido. O Android recorta em
#                                             círculo, quadrado arredondado
#                                             ou "squircle" conforme o
#                                             aparelho; a zona segura é um
#                                             círculo de 80% do lado, e a
#                                             logo já é redonda, então 72%
#                                             sobra margem sem encolher.
#   aura-icone-180.png           iPhone     — apple-touch-icon. O iOS
#                                             ignora transparência (vira
#                                             preto) e arredonda os cantos
#                                             sozinho: fundo sólido, logo a
#                                             80%, sem alfa.
#
# O fundo é o bg do tema escuro (constants/colors.ts, Dark.bg = #060816),
# igual ao background_color do manifesto, para a tela de abertura e o
# ícone lerem como uma coisa só.
#
# Os 72 e 192 que já existem (avisos do sw.js, 10/09) ficam como estão.
# ============================================================
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
ORIGEM = RAIZ / "assets" / "Icon.png"
PUBLIC = RAIZ / "public"
FUNDO = (0x06, 0x08, 0x16, 255)  # Dark.bg


def recortar_conteudo(img: Image.Image) -> Image.Image:
    """Corta a borda transparente (se houver) para centralizar de verdade."""
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def quadrado(logo: Image.Image, lado: int, escala: float, fundo) -> Image.Image:
    tela = Image.new("RGBA", (lado, lado), fundo if fundo else (0, 0, 0, 0))
    alvo = int(round(lado * escala))
    miniatura = logo.copy()
    miniatura.thumbnail((alvo, alvo), Image.LANCZOS)
    pos = ((lado - miniatura.width) // 2, (lado - miniatura.height) // 2)
    tela.alpha_composite(miniatura, pos)
    return tela


def main() -> None:
    src = Image.open(ORIGEM).convert("RGBA")
    canto_alfa = src.getpixel((0, 0))[3]
    transparente = canto_alfa < 128
    logo = recortar_conteudo(src) if transparente else src
    print(f"origem {ORIGEM.name}: {src.width}x{src.height}, canto alfa={canto_alfa} "
          f"({'transparente' if transparente else 'opaco'})")

    # "any": se a origem já tem fundo opaco, não adianta fingir transparência.
    any512 = quadrado(logo, 512, 1.0, None if transparente else FUNDO)
    any512.save(PUBLIC / "aura-icone-512.png", optimize=True)

    mask512 = quadrado(logo, 512, 0.72, FUNDO)
    mask512.save(PUBLIC / "aura-icone-512-maskable.png", optimize=True)

    ios180 = quadrado(logo, 180, 0.80, FUNDO).convert("RGB")
    ios180.save(PUBLIC / "aura-icone-180.png", optimize=True)

    for nome in ("aura-icone-512.png", "aura-icone-512-maskable.png", "aura-icone-180.png"):
        p = PUBLIC / nome
        im = Image.open(p)
        print(f"  {nome:30s} {im.width}x{im.height} {im.mode:5s} {p.stat().st_size:>7,} bytes")


if __name__ == "__main__":
    main()
