"""Propositions de logos « au crayon » pour Rift Live : une dizaine de pistes, dans le style commun des applis
(voir generer.py : papier crème, contours au graphite repassés deux fois, aplat léger puis hachures appuyées).

Écrit design/logo/propositions/NN-nom.svg. Les PNG et la planche se font avec propositions.cjs.
Lancer : python3 design/logo/propositions.py"""
import math
import os
import re

import generer as g
from generer import Crayon, cercle, courbe, ellipse

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "propositions")

# Crayons de plus pour ces pistes.
g.CRAYONS.update({
    "rouge": ("#F2A59E", "#D6453D"),
    "gris": ("#D3D8E0", "#7C8594"),
    "violet": ("#C9BBEA", "#7A5BC4"),
    "brun": ("#E3C29A", "#A8743A"),
})


def ombre(c, cx=54, cy=82, rx=14):
    c.hachures(ellipse(cx, cy, rx, 2.8), "ombre", spacing=2.4, angle=-20, width=1.0)


def chemin(*items):
    """Points d'un chemin : ('M', p), ('L', p), ('Q', ctrl, p), ('A', cx, cy, rx, ry, t0, t1)."""
    pts = []
    for it in items:
        k = it[0]
        if k in "ML":
            pts.append(it[1])
        elif k == "Q":
            pts += courbe(pts[-1], it[1], it[2])[1:]
        elif k == "A":
            _, cx, cy, rx, ry, t0, t1 = it
            pts += ellipse(cx, cy, rx, ry, 0, t0, t1, 24)
    return pts


def etoile(c, x, y, r, w=2.0):
    c.ligne((x - r, y), (x + r, y), "trait", width=w)
    c.ligne((x, y - r), (x, y + r), "trait", width=w)


def epee(c, pied, pointe, lame="gris", poignee="brun", largeur=5.0):
    """Une épée de `pied` (pommeau) à `pointe`."""
    dx, dy = pointe[0] - pied[0], pointe[1] - pied[1]
    n = math.hypot(dx, dy)
    ux, uy = dx / n, dy / n
    px, py = -uy, ux
    at = lambda t, s=0: (pied[0] + ux * t + px * s, pied[1] + uy * t + py * s)
    garde = 0.26 * n
    blade = [at(garde, -largeur), at(n - 7, -largeur), at(n, 0), at(n - 7, largeur), at(garde, largeur)]
    c.remplir(blade, lame)
    c.hachures([at(garde, 0), at(n - 7, 0), at(n, 0), at(n - 7, largeur), at(garde, largeur)], lame + ".h", spacing=3.0, angle=-40)
    c.trait(blade, "trait", close=True)
    c.ligne(at(garde + 2, 0), at(n - 5, 0), "trait", width=1.4, passes=1)
    c.ligne(at(garde, -largeur - 5), at(garde, largeur + 5), "trait", width=3.4)
    c.ligne(at(1.5), at(garde - 1), poignee + ".h", width=4.6, passes=1)
    c.ligne(at(1.5), at(garde - 1), "trait", width=1.4, passes=1)
    c.trait(cercle(*at(-1), 3.2, 16), "trait", close=True, width=2.0)


# ---------- Les pistes ----------

def p01_cristal(c):
    g.dessin(c)


def p02_epees(c):
    ombre(c, 54, 84, 18)
    epee(c, (30, 76), (80, 26), "gris")
    epee(c, (78, 76), (28, 26), "bleu")
    c.remplir([(54, 40), (60, 51), (54, 62), (48, 51)], "or")
    c.hachures([(54, 40), (60, 51), (54, 62), (48, 51)], "or.h", spacing=3.2, angle=-40)
    c.trait([(54, 40), (60, 51), (54, 62), (48, 51)], "trait", close=True, width=2.2)
    etoile(c, 28, 52, 3.5)
    etoile(c, 82, 50, 3.5)


def p03_trophee(c):
    ombre(c, 54, 82, 15)
    bol = chemin(("M", (36, 28)), ("L", (72, 28)), ("Q", (72, 48), (60, 56)), ("Q", (56, 59), (56, 62)), ("L", (52, 62)), ("Q", (52, 59), (48, 56)), ("Q", (36, 48), (36, 28)))
    c.remplir(bol, "or")
    c.hachures(chemin(("M", (54, 28)), ("L", (72, 28)), ("Q", (72, 48), (60, 56)), ("Q", (56, 59), (56, 62)), ("L", (54, 62))), "or.h", spacing=3.4, angle=-40)
    for sgn in (-1, 1):
        x0 = 54 + sgn * 18
        c.trait(chemin(("M", (x0, 33)), ("Q", (54 + sgn * 31, 33), (54 + sgn * 25, 45)), ("Q", (54 + sgn * 22, 50), (54 + sgn * 14, 52))), "trait", width=2.6)
    c.trait(bol, "trait", close=True)
    c.ligne((36, 28), (72, 28), "trait", width=3.0)
    base = [(44, 66), (64, 66), (68, 76), (40, 76)]
    c.remplir(base, "brun")
    c.hachures(base, "brun.h", spacing=3.4, angle=-40)
    c.trait(base, "trait", close=True)
    c.trait([(51, 62), (57, 62), (58, 66), (50, 66)], "trait", close=True, width=2.2)
    etoile(c, 54, 41, 4.5, 2.2)
    etoile(c, 28, 34, 3.2)
    etoile(c, 82, 40, 3.2)


def p04_poro(c):
    ombre(c, 54, 82, 20)
    for sgn in (-1, 1):  # cornes
        corne = chemin(("M", (54 + sgn * 11, 40)), ("Q", (54 + sgn * 22, 30), (54 + sgn * 17, 20)), ("Q", (54 + sgn * 9, 28), (54 + sgn * 5, 38)))
        c.remplir(corne, "violet")
        c.trait(corne, "trait", close=True, width=2.4)
    corps = ellipse(54, 56, 24, 22, 0, 0, 360, 40)
    c.remplir(corps, "page")
    c.hachures(chemin(("M", (62, 36)), ("Q", (82, 46), (76, 66)), ("Q", (68, 78), (56, 78)), ("L", (66, 56))), "bleu.h", spacing=3.8, angle=-40, width=1.2)
    c.trait(corps, "trait", close=True)
    # Touffes de fourrure sur les joues.
    for sgn in (-1, 1):
        c.trait(chemin(("M", (54 + sgn * 23, 60)), ("L", (54 + sgn * 28, 63)), ("L", (54 + sgn * 23, 66))), "trait", width=2.0)
        c.trait(chemin(("M", (54 + sgn * 22, 68)), ("L", (54 + sgn * 26, 72)), ("L", (54 + sgn * 20, 72))), "trait", width=2.0)
    for sgn in (-1, 1):  # yeux
        c.remplir(ellipse(54 + sgn * 10, 52, 4.2, 5.4), "trait")
        c.trait(ellipse(54 + sgn * 10, 52, 4.2, 5.4), "trait", close=True, width=1.8)
        c.remplir(cercle(54 + sgn * 10 - 1.2, 50, 1.3, 10), "page")
    c.remplir(ellipse(54, 60, 4.4, 3.2), "orange")
    c.trait(ellipse(54, 60, 4.4, 3.2), "trait", close=True, width=1.8)
    langue = chemin(("M", (50, 66)), ("Q", (50, 76), (54, 76)), ("Q", (58, 76), (58, 66)))
    c.remplir(langue, "rouge")
    c.hachures(langue + [(50, 66)], "rouge.h", spacing=2.8, angle=-30, width=1.1)
    c.trait(chemin(("M", (47, 65)), ("Q", (54, 69), (61, 65))), "trait", width=2.0)
    c.trait(langue, "trait", width=2.0)
    etoile(c, 28, 34, 3.2)
    etoile(c, 82, 74, 3.2)


def p05_potion(c):
    ombre(c, 54, 83, 16)
    bulbe = ellipse(54, 60, 19, 19, 0, 0, 360, 40)
    c.remplir(bulbe, "page")
    liquide = chemin(("M", (35.5, 56)), ("Q", (44, 51), (54, 56)), ("Q", (64, 61), (72.5, 55))) + ellipse(54, 60, 19, 19, 0, 8, 172, 30)
    c.remplir(liquide, "rouge")
    c.hachures(liquide, "rouge.h", spacing=3.2, angle=-40)
    c.trait(bulbe, "trait", close=True)
    col = [(49, 41), (59, 41), (59, 29), (49, 29)]
    c.remplir(col, "page")
    c.trait(col, "trait", close=True)
    c.trait(chemin(("M", (46, 29)), ("L", (62, 29))), "trait", width=3.0)
    bouchon = [(50, 29), (58, 29), (57, 21), (51, 21)]
    c.remplir(bouchon, "brun")
    c.hachures(bouchon, "brun.h", spacing=2.6, angle=-40)
    c.trait(bouchon, "trait", close=True)
    for (x, y, r) in ((50, 64, 2.2), (58, 69, 1.6), (60, 58, 1.2)):
        c.trait(cercle(x, y, r, 12), "trait", close=True, width=1.4, passes=1)
    c.trait(chemin(("M", (41, 50)), ("Q", (39, 56), (41, 62))), "trait", width=1.6, passes=1, opacity=0.6)
    etoile(c, 30, 40, 3.8)
    etoile(c, 80, 34, 3.2)
    etoile(c, 82, 72, 3.2)


def p06_nexus(c):
    ombre(c, 54, 84, 22)
    base = [(30, 76), (78, 76), (84, 82), (24, 82)]
    c.remplir(base, "gris")
    c.hachures(base, "gris.h", spacing=3.2, angle=-35)
    c.trait(base, "trait", close=True, width=2.4)
    tour = [(40, 76), (45, 42), (63, 42), (68, 76)]
    c.remplir(tour, "gris")
    c.hachures([(54, 42), (63, 42), (68, 76), (54, 76)], "gris.h", spacing=3.4, angle=-40)
    c.trait(tour, "trait", close=True)
    for y in (52, 62, 70):  # briques
        dx = (y - 42) * 0.15
        c.ligne((45 - dx + 1, y), (63 + dx - 1, y), "trait", width=1.4, passes=1)
    for x in ((50, 50), (58, 62)):
        c.ligne((x[0], 52), (x[0], 62), "trait", width=1.4, passes=1)
    cren = [(42, 42), (42, 34), (47, 34), (47, 38), (51, 38), (51, 34), (57, 34), (57, 38), (61, 38), (61, 34), (66, 34), (66, 42)]
    c.remplir(cren, "gris")
    c.trait(cren, "trait", close=True)
    gem = [(54, 14), (60, 24), (54, 33), (48, 24)]
    c.remplir(gem, "sarcelle")
    c.hachures(gem, "sarcelle.h", spacing=3.0, angle=-40)
    c.trait(gem, "trait", close=True, width=2.2)
    etoile(c, 36, 22, 3.5)
    etoile(c, 74, 20, 3.0)
    etoile(c, 80, 40, 2.6)


def p07_ward(c):
    ombre(c, 54, 84, 12)
    pieu = [(49, 60), (59, 60), (54, 82)]
    c.remplir(pieu, "brun")
    c.hachures(pieu, "brun.h", spacing=2.8, angle=-40)
    c.trait(pieu, "trait", close=True, width=2.4)
    oeil = chemin(("M", (24, 44)), ("Q", (54, 14), (84, 44)), ("Q", (54, 76), (24, 44)))
    c.remplir(oeil, "page")
    c.trait(oeil, "trait", close=True)
    iris = ellipse(54, 44, 13, 13, 0, 0, 360, 36)
    c.remplir(iris, "vert")
    c.hachures(iris, "vert.h", spacing=3.0, angle=-40)
    c.trait(iris, "trait", close=True, width=2.2)
    c.remplir(ellipse(54, 44, 5.4, 5.4), "trait")
    c.remplir(cercle(51.5, 41.5, 2.0, 10), "page")
    for ang in (-50, -25, 0, 25, 50):  # rayons de vision
        a = math.radians(ang - 90)
        c.ligne((54 + 36 * math.cos(a), 46 + 36 * math.sin(a)), (54 + 43 * math.cos(a), 46 + 43 * math.sin(a)), "trait", width=2.0, passes=1)


def p08_faille(c):
    ombre(c, 54, 84, 22)
    carte = [(26, 28), (82, 28), (82, 80), (26, 80)]
    c.remplir(carte, "vert")
    c.hachures(carte, "vert.h", spacing=4.2, angle=-35, width=1.0)
    riviere = [(26, 70), (26, 54), (66, 28), (82, 28), (82, 40), (42, 80), (26, 80)]
    c.remplir([(26, 60), (60, 28), (82, 28), (82, 36), (44, 80), (26, 80)], "bleu")
    c.hachures([(26, 60), (60, 28), (82, 28), (82, 36), (44, 80), (26, 80)], "bleu.h", spacing=3.4, angle=-40)
    c.trait(carte, "trait", close=True)
    for pts in ([(32, 74), (32, 36), (40, 34)], [(76, 34), (76, 74), (36, 74)]):  # couloirs haut et bas
        pass
    c.trait([(31, 72), (31, 35), (68, 34)], "gris.h", width=3.2, passes=1)
    c.trait([(40, 74), (77, 74), (77, 40)], "gris.h", width=3.2, passes=1)
    c.ligne((34, 72), (74, 34), "trait", width=2.0, passes=1)
    c.remplir(cercle(33, 73, 6.5, 24), "bleu")
    c.trait(cercle(33, 73, 6.5, 24), "trait", close=True, width=2.2)
    c.remplir(cercle(75, 35, 6.5, 24), "rouge")
    c.trait(cercle(75, 35, 6.5, 24), "trait", close=True, width=2.2)
    c.remplir(cercle(46, 52, 3.4, 16), "violet")
    c.trait(cercle(46, 52, 3.4, 16), "trait", close=True, width=1.8)
    c.remplir(cercle(62, 56, 3.4, 16), "orange")
    c.trait(cercle(62, 56, 3.4, 16), "trait", close=True, width=1.8)


def p09_hexagone(c):
    ombre(c, 54, 84, 18)
    def hexa(r, cx=54, cy=52):
        return [(cx + r * math.cos(math.radians(60 * k - 90)), cy + r * math.sin(math.radians(60 * k - 90))) for k in range(6)]
    ext = hexa(28)
    c.remplir(ext, "bleu")
    c.hachures(hexa(28)[:4] + [(54, 52)], "bleu.h", spacing=3.4, angle=-40)
    c.trait(ext, "trait", close=True, width=3.0)
    inte = hexa(19)
    c.remplir(inte, "page")
    c.trait(inte, "trait", close=True, width=2.2)
    eclair = [(58, 32), (45, 54), (53, 54), (49, 72), (64, 48), (55, 48)]
    c.remplir(eclair, "jaune")
    c.hachures(eclair, "jaune.h", spacing=2.8, angle=-40, width=1.2)
    c.trait(eclair, "trait", close=True, width=2.2)
    etoile(c, 26, 26, 3.4)
    etoile(c, 84, 78, 3.4)


def p10_bouclier(c):
    ombre(c, 54, 84, 17)
    epee(c, (54, 88), (54, 14), "gris")
    ecu = chemin(("M", (34, 30)), ("L", (74, 30)), ("L", (74, 52)), ("Q", (74, 68), (54, 80)), ("Q", (34, 68), (34, 52)))
    c.remplir(ecu, "bleu")
    c.hachures(chemin(("M", (54, 30)), ("L", (74, 30)), ("L", (74, 52)), ("Q", (74, 68), (54, 80))), "bleu.h", spacing=3.4, angle=-40)
    c.trait(ecu, "trait", close=True, width=3.0)
    cadre = chemin(("M", (39, 35)), ("L", (69, 35)), ("L", (69, 52)), ("Q", (69, 64), (54, 73)), ("Q", (39, 64), (39, 52)))
    c.trait(cadre, "page", close=True, width=1.6, passes=1)
    gem = [(54, 40), (62, 52), (54, 66), (46, 52)]
    c.remplir(gem, "or")
    c.hachures(gem, "or.h", spacing=3.0, angle=-40)
    c.trait(gem, "trait", close=True, width=2.2)
    etoile(c, 26, 56, 3.4)
    etoile(c, 84, 60, 3.4)


_PAIR = re.compile(r"(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)")


def cadrer(c, rayon=35.0, centre=(54.0, 54.0)):
    """Centre le dessin et le réduit au besoin pour qu'il tienne dans le cercle sûr de l'icône adaptative Android
    (66 sur la grille de 108)."""
    xs, ys = [], []
    for sorte, d, _col, _alpha, _width, clip in c.elements:
        # Les hachures débordent de leur forme (elles sont découpées) : on mesure la forme elle-même.
        for x, y in _PAIR.findall(clip or d):
            xs.append(float(x))
            ys.append(float(y))
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    loin = max(math.hypot(x - mx, y - my) for x, y in zip(xs, ys))
    k = min(1.0, rayon / loin)

    def tr(txt):
        return _PAIR.sub(lambda m: f"{(float(m[1]) - mx) * k + centre[0]:.1f} {(float(m[2]) - my) * k + centre[1]:.1f}", txt)

    c.elements = [(sorte, tr(d), col, alpha, width, tr(clip) if clip else clip) for sorte, d, col, alpha, width, clip in c.elements]


PISTES = [
    ("cristal", "Cristal hextech", p01_cristal),
    ("epees", "Épées croisées", p02_epees),
    ("trophee", "Coupe de l'Invocateur", p03_trophee),
    ("poro", "Poro", p04_poro),
    ("potion", "Potion de soin", p05_potion),
    ("nexus", "Nexus", p06_nexus),
    ("ward", "Balise de vision", p07_ward),
    ("faille", "Faille de l'Invocateur", p08_faille),
    ("hexagone", "Hexagone hextech", p09_hexagone),
    ("bouclier", "Bouclier et épée", p10_bouclier),
]

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    liste = []
    for i, (cle, nom, fn) in enumerate(PISTES, 1):
        c = Crayon(10 + i)
        fn(c)
        cadrer(c)
        fichier = f"{i:02d}-{cle}.svg"
        with open(os.path.join(OUT, fichier), "w") as f:
            f.write(c.svg(f"Rift Live : {nom}", view="18 18 72 72", coins=15.75))
        liste.append((fichier, nom))
        print(fichier, nom)
    with open(os.path.join(OUT, "liste.json"), "w") as f:
        import json
        json.dump(liste, f, ensure_ascii=False)
