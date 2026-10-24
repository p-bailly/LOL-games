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
    """Les éclats « + » autour des dessins ont été retirés (demande de l'utilisateur) : plus rien n'est tracé."""


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
    haut, droite, bas, gauche = (58, 28), (76, 49), (58, 80), (40, 49)
    ombre(c, 58, 84, 15)
    gemme = [haut, droite, bas, gauche]
    c.remplir(gemme, "or")
    c.hachures([haut, droite, (58, 49)], "or.h", spacing=3.4, angle=-40)
    c.hachures([(58, 49), droite, bas], "or.h", spacing=3.4, angle=-40)
    c.trait(gemme, "trait", close=True)
    c.ligne(gauche, droite, "trait", width=2.0)
    c.ligne(haut, (49, 49), "trait", width=2.0)
    c.ligne(haut, (67, 49), "trait", width=2.0)
    c.ligne((49, 49), bas, "trait", width=2.0)
    c.ligne((67, 49), bas, "trait", width=2.0)


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



# ---------- Pistes supplémentaires ----------

def arrondi(x0, y0, x1, y1, r=4.0):
    """Rectangle aux coins arrondis, en points."""
    return (ellipse(x1 - r, y0 + r, r, r, 0, 270, 360, 6) + ellipse(x1 - r, y1 - r, r, r, 0, 0, 90, 6)
            + ellipse(x0 + r, y1 - r, r, r, 0, 90, 180, 6) + ellipse(x0 + r, y0 + r, r, r, 0, 180, 270, 6))


def miroir(pts, axe=54):
    return [(2 * axe - x, y) for x, y in reversed(pts)]


def lettre(c, ch, cx, cy):
    t = lambda *a, **k: c.trait(*a, "trait", **{"width": 2.6, **k})
    if ch == "Q":
        t(ellipse(cx - 0.5, cy - 0.5, 5, 5.4, 0, 0, 360, 20), close=True)
        t([(cx + 2, cy + 2.5), (cx + 6, cy + 6.5)])
    elif ch == "W":
        t([(cx - 6.5, cy - 5), (cx - 3, cy + 5), (cx, cy - 1), (cx + 3, cy + 5), (cx + 6.5, cy - 5)])
    elif ch == "E":
        t([(cx + 4, cy - 5), (cx - 4, cy - 5), (cx - 4, cy + 5), (cx + 4, cy + 5)])
        t([(cx - 4, cy), (cx + 3, cy)])
    elif ch == "R":
        t([(cx - 4, cy + 5.5), (cx - 4, cy - 5), (cx + 2, cy - 5)] + chemin(("M", (cx + 2, cy - 5)), ("Q", (cx + 6.5, cy - 5), (cx + 6.5, cy - 2.2)), ("Q", (cx + 6.5, cy + 0.5), (cx + 2, cy + 0.5)))[1:] + [(cx - 4, cy + 0.5)])
        t([(cx + 0.5, cy + 0.5), (cx + 5.5, cy + 5.5)])


def p11_qwer(c):
    ombre(c, 54, 85, 24)
    for ch, col, (x, y) in (("Q", "bleu", (27, 28)), ("W", "sarcelle", (57, 28)), ("E", "or", (27, 58)), ("R", "rouge", (57, 58))):
        touche = arrondi(x, y, x + 26, y + 26, 5)
        c.remplir(touche, col)
        c.hachures(arrondi(x + 13, y, x + 26, y + 26, 5), col + ".h", spacing=3.4, angle=-40)
        c.trait(touche, "trait", close=True, width=2.8)
        lettre(c, ch, x + 13, y + 13)


def p12_baron(c):
    ombre(c, 54, 84, 22)
    pointes = [(30, 52), (34, 30), (43, 42), (48, 22), (54, 38), (60, 22), (65, 42), (74, 30), (78, 52)]
    tete = pointes + chemin(("M", (78, 52)), ("Q", (80, 70), (66, 76)), ("L", (60, 70)), ("L", (54, 78)), ("L", (48, 70)), ("L", (42, 76)), ("Q", (28, 70), (30, 52)))[1:]
    c.remplir(tete, "violet")
    c.hachures(tete, "violet.h", spacing=3.4, angle=-40)
    c.trait(tete, "trait", close=True, width=2.8)
    oeil = chemin(("M", (35, 56)), ("Q", (54, 42), (73, 56)), ("Q", (54, 68), (35, 56)))
    c.remplir(oeil, "page")
    c.trait(oeil, "trait", close=True, width=2.4)
    iris = ellipse(54, 56, 8, 8, 0, 0, 360, 24)
    c.remplir(iris, "jaune")
    c.hachures(iris, "jaune.h", spacing=2.6, angle=-40, width=1.1)
    c.trait(iris, "trait", close=True, width=2.0)
    c.remplir(ellipse(54, 56, 2.2, 7), "trait")


def p13_dragon(c):
    ombre(c, 54, 85, 20)
    moitie = [(54, 36), (64, 35), (74, 44), (77, 56), (72, 68), (62, 76), (54, 80)]
    tete = moitie + miroir(moitie)
    for sgn in (-1, 1):  # cornes
        corne = chemin(("M", (54 + sgn * 9, 38)), ("Q", (54 + sgn * 20, 36), (54 + sgn * 22, 18)), ("Q", (54 + sgn * 11, 26), (54 + sgn * 5, 35)))
        c.remplir(corne, "brun")
        c.trait(corne, "trait", close=True, width=2.4)
        aile = [(54 + sgn * 22, 46), (54 + sgn * 33, 38), (54 + sgn * 30, 52), (54 + sgn * 33, 60), (54 + sgn * 22, 60)]
        c.remplir(aile, "orange")
        c.trait(aile, "trait", close=True, width=2.2)
    c.remplir(tete, "vert")
    c.hachures(moitie + [(54, 36)], "vert.h", spacing=3.2, angle=-40)
    c.trait(tete, "trait", close=True, width=2.8)
    for sgn in (-1, 1):
        oeil = chemin(("M", (54 + sgn * 6, 54)), ("Q", (54 + sgn * 12, 47), (54 + sgn * 19, 52)), ("Q", (54 + sgn * 13, 59), (54 + sgn * 6, 54)))
        c.remplir(oeil, "jaune")
        c.trait(oeil, "trait", close=True, width=2.0)
        c.remplir(ellipse(54 + sgn * 12.5, 53.2, 1.5, 3.6), "trait")
        c.remplir(ellipse(54 + sgn * 5.5, 68, 1.9, 2.8), "trait")
    c.trait([(46, 76), (48.5, 71), (51, 76)], "trait", width=1.8, passes=1)
    c.trait([(57, 76), (59.5, 71), (62, 76)], "trait", width=1.8, passes=1)


def p14_couronne(c):
    ombre(c, 54, 84, 22)
    couronne = [(30, 70), (28, 34), (42, 50), (54, 28), (66, 50), (80, 34), (78, 70)]
    c.remplir(couronne, "or")
    c.hachures([(54, 28), (66, 50), (80, 34), (78, 70), (54, 70)], "or.h", spacing=3.4, angle=-40)
    c.trait(couronne, "trait", close=True, width=3.0)
    bande = [(30, 62), (78, 62), (78, 74), (30, 74)]
    c.remplir(bande, "or")
    c.trait(bande, "trait", close=True, width=2.6)
    for x, y, col in ((28, 34, "rouge"), (54, 28, "bleu"), (80, 34, "rouge")):
        c.remplir(cercle(x, y, 4.4, 16), col)
        c.trait(cercle(x, y, 4.4, 16), "trait", close=True, width=2.0)
    gem = [(54, 63), (59, 68), (54, 73), (49, 68)]
    c.remplir(gem, "sarcelle")
    c.trait(gem, "trait", close=True, width=2.0)
    for x in (38, 70):
        c.remplir(cercle(x, 68, 2.2, 10), "bleu")
        c.trait(cercle(x, 68, 2.2, 10), "trait", close=True, width=1.6, passes=1)


def p15_orbe(c):
    ombre(c, 54, 84, 18)
    pied = [(40, 72), (68, 72), (72, 80), (36, 80)]
    c.remplir(pied, "brun")
    c.hachures(pied, "brun.h", spacing=3.2, angle=-40)
    c.trait(pied, "trait", close=True, width=2.4)
    c.trait([(44, 68), (64, 68), (66, 72), (42, 72)], "trait", close=True, width=2.2)
    sphere = ellipse(54, 48, 24, 24, 0, 0, 360, 44)
    c.remplir(sphere, "bleu")
    c.hachures(chemin(("M", (54, 24)), ("Q", (82, 40), (68, 66)), ("Q", (60, 72), (54, 72)), ("L", (54, 24))), "bleu.h", spacing=3.4, angle=-40)
    c.trait(sphere, "trait", close=True, width=3.0)
    gem = [(54, 36), (61, 48), (54, 60), (47, 48)]
    c.remplir(gem, "or")
    c.hachures(gem, "or.h", spacing=3.0, angle=-40)
    c.trait(gem, "trait", close=True, width=2.2)
    c.trait(chemin(("M", (38, 40)), ("Q", (40, 32), (47, 30))), "page", width=3.2, passes=1)


def p16_heaume(c):
    ombre(c, 54, 84, 20)
    plume = chemin(("M", (54, 30)), ("Q", (50, 12), (68, 14)), ("Q", (62, 18), (64, 30)))
    c.remplir(plume, "rouge")
    c.hachures(plume, "rouge.h", spacing=3.0, angle=-40)
    c.trait(plume, "trait", close=True, width=2.4)
    dome = chemin(("M", (32, 62)), ("L", (32, 46)), ("Q", (32, 26), (54, 26)), ("Q", (76, 26), (76, 46)), ("L", (76, 62)), ("L", (68, 76)), ("L", (40, 76)))
    c.remplir(dome, "gris")
    c.hachures(chemin(("M", (54, 26)), ("Q", (76, 26), (76, 46)), ("L", (76, 62)), ("L", (68, 76)), ("L", (54, 76))), "gris.h", spacing=3.4, angle=-40)
    c.trait(dome, "trait", close=True, width=3.0)
    c.ligne((54, 26), (54, 50), "trait", width=2.2)
    fente = [(36, 50), (72, 50), (72, 58), (36, 58)]
    c.remplir(fente, "trait")
    c.trait(fente, "trait", close=True, width=2.0)
    for x in (42, 66):  # aération de la mentonnière
        c.ligne((x, 64), (x, 72), "trait", width=2.0, passes=1)
    c.ligne((54, 62), (54, 74), "trait", width=2.0, passes=1)


def p17_minion(c):
    ombre(c, 54, 84, 18)
    robe = chemin(("M", (38, 78)), ("Q", (38, 62), (46, 58)), ("L", (62, 58)), ("Q", (70, 62), (70, 78)))
    c.remplir(robe, "bleu")
    c.hachures(robe, "bleu.h", spacing=3.2, angle=-40)
    c.trait(robe, "trait", close=True, width=2.6)
    visage = ellipse(54, 52, 16, 14, 0, 0, 360, 32)
    c.remplir(visage, "gris")
    c.trait(visage, "trait", close=True, width=2.6)
    for sgn in (-1, 1):
        c.remplir(ellipse(54 + sgn * 6.5, 51, 4.2, 5), "page")
        c.trait(ellipse(54 + sgn * 6.5, 51, 4.2, 5), "trait", close=True, width=1.8)
        c.remplir(cercle(54 + sgn * 6.5, 52, 1.9, 10), "trait")
    c.trait(chemin(("M", (48, 60)), ("Q", (54, 64), (60, 60))), "trait", width=2.0, passes=1)
    chapeau = [(36, 44), (72, 44), (60, 40), (56, 14), (48, 40)]
    c.remplir(chapeau, "violet")
    c.hachures(chapeau, "violet.h", spacing=3.0, angle=-40)
    c.trait(chapeau, "trait", close=True, width=2.6)
    c.ligne((34, 44), (74, 44), "trait", width=3.2)
    c.remplir([(54, 28), (56, 33), (61, 33), (57, 36), (59, 41), (54, 38), (49, 41), (51, 36), (47, 33), (52, 33)], "jaune")


def p18_ecran(c):
    ombre(c, 54, 85, 22)
    ecran = arrondi(26, 24, 82, 64, 5)
    c.remplir(ecran, "gris")
    c.trait(ecran, "trait", close=True, width=3.0)
    vitre = arrondi(31, 29, 77, 59, 3)
    c.remplir(vitre, "bleu")
    c.hachures(arrondi(54, 29, 77, 59, 3), "bleu.h", spacing=3.4, angle=-40)
    c.trait(vitre, "trait", close=True, width=2.0)
    gem = [(54, 33), (62, 44), (54, 56), (46, 44)]
    c.remplir(gem, "or")
    c.hachures(gem, "or.h", spacing=3.0, angle=-40)
    c.trait(gem, "trait", close=True, width=2.2)
    c.remplir(cercle(37, 35, 3.2, 14), "rouge")
    c.trait(cercle(37, 35, 3.2, 14), "trait", close=True, width=1.6, passes=1)
    c.trait([(50, 64), (58, 64), (60, 72), (48, 72)], "trait", close=True, width=2.4)
    base = arrondi(38, 72, 70, 78, 2.5)
    c.remplir(base, "gris")
    c.trait(base, "trait", close=True, width=2.6)



# ---------- Baron Nashor et champions ----------

def etoile_pts(cx, cy, r_ext, r_int, n, rot=-90):
    pts = []
    for k in range(2 * n):
        r = r_ext if k % 2 == 0 else r_int
        a = math.radians(rot + 180 * k / n)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def p19_baron_oeil(c):
    ombre(c, 54, 86, 22)
    flammes = etoile_pts(54, 52, 33, 24, 10)
    c.remplir(flammes, "violet")
    c.hachures(flammes, "violet.h", spacing=3.6, angle=-40)
    c.trait(flammes, "trait", close=True, width=2.8)
    oeil = chemin(("M", (28, 52)), ("Q", (54, 28), (80, 52)), ("Q", (54, 76), (28, 52)))
    c.remplir(oeil, "page")
    c.trait(oeil, "trait", close=True, width=2.6)
    iris = ellipse(54, 52, 13, 13, 0, 0, 360, 32)
    c.remplir(iris, "jaune")
    c.hachures(iris, "jaune.h", spacing=2.8, angle=-40, width=1.1)
    c.trait(iris, "trait", close=True, width=2.2)
    c.remplir(ellipse(54, 52, 3.4, 11.5), "trait")
    c.remplir(cercle(51, 46, 1.8, 10), "page")


def p20_baron_crocs(c):
    ombre(c, 54, 86, 22)
    tete = [(28, 46), (30, 26), (42, 38), (54, 18), (66, 38), (78, 26), (80, 46), (78, 66), (54, 80), (30, 66)]
    c.remplir(tete, "violet")
    c.hachures(tete, "violet.h", spacing=3.4, angle=-40)
    c.trait(tete, "trait", close=True, width=2.8)
    bouche = ellipse(54, 62, 20, 11, 0, 0, 360, 36)
    c.remplir(bouche, "trait")
    c.remplir(chemin(("M", (44, 66)), ("Q", (54, 74), (64, 66)), ("Q", (54, 64), (44, 66))), "rouge")
    for x in (39, 48, 60, 69):  # crocs du haut
        c.remplir([(x - 3, 54), (x + 3, 54), (x, 63)], "page")
    for x in (45, 63):  # crocs du bas
        c.remplir([(x - 2.5, 71), (x + 2.5, 71), (x, 63)], "page")
    c.trait(bouche, "trait", close=True, width=2.4)
    for sgn in (-1, 1):
        oeil = chemin(("M", (54 + sgn * 6, 44)), ("Q", (54 + sgn * 13, 36), (54 + sgn * 22, 42)), ("Q", (54 + sgn * 13, 50), (54 + sgn * 6, 44)))
        c.remplir(oeil, "jaune")
        c.trait(oeil, "trait", close=True, width=2.0)
        c.remplir(ellipse(54 + sgn * 14, 43.5, 1.5, 4.2), "trait")


def p21_baron_tentacule(c):
    ombre(c, 54, 86, 20)
    # Axe en spirale, largeur décroissante vers la pointe.
    axe = []
    for k in range(0, 61):
        t = k / 60
        a = math.radians(200 + 460 * t)
        r = 25 - 17 * t
        axe.append((54 + r * math.cos(a), 54 + 3 + r * math.sin(a), 8.5 * (1 - t) + 1.2))
    gauche, droite = [], []
    for i, (x, y, w) in enumerate(axe):
        x2, y2, _ = axe[min(i + 1, len(axe) - 1)]
        x1, y1, _ = axe[max(i - 1, 0)]
        dx, dy = x2 - x1, y2 - y1
        n = math.hypot(dx, dy) or 1
        gauche.append((x - dy / n * w, y + dx / n * w))
        droite.append((x + dy / n * w, y - dx / n * w))
    corps = gauche + droite[::-1]
    c.remplir(corps, "violet")
    c.hachures(corps, "violet.h", spacing=3.4, angle=-40)
    c.trait(corps, "trait", close=True, width=2.6)
    for i in range(6, 56, 7):  # ventouses
        x, y, w = axe[i]
        if w > 3:
            c.remplir(cercle(x, y, w * 0.42, 10), "rouge")
            c.trait(cercle(x, y, w * 0.42, 10), "trait", close=True, width=1.4, passes=1)


def p22_teemo(c):
    ombre(c, 54, 84, 20)
    pied = chemin(("M", (42, 52)), ("L", (42, 70)), ("Q", (42, 78), (54, 78)), ("Q", (66, 78), (66, 70)), ("L", (66, 52)))
    c.remplir(pied, "page")
    c.hachures(chemin(("M", (54, 52)), ("L", (66, 52)), ("L", (66, 70)), ("Q", (66, 78), (54, 78))), "brun.h", spacing=3.4, angle=-40)
    c.trait(pied, "trait", close=True, width=2.6)
    chapeau = ellipse(54, 50, 29, 26, 0, 180, 360, 30) + [(83, 50)]
    chapeau = chapeau + [(25, 50)]
    c.remplir(chapeau, "rouge")
    c.hachures(ellipse(54, 50, 29, 26, 0, 270, 360, 12) + [(54, 50)], "rouge.h", spacing=3.4, angle=-40)
    c.trait(chapeau, "trait", close=True, width=2.8)
    for x, y, r in ((40, 36, 4.6), (58, 30, 5.4), (70, 42, 3.8), (47, 46, 2.6)):
        c.remplir(cercle(x, y, r, 14), "page")
        c.trait(cercle(x, y, r, 14), "trait", close=True, width=1.8, passes=1)
    for sgn in (-1, 1):
        c.remplir(cercle(54 + sgn * 6, 62, 2.2, 10), "trait")
    c.trait(chemin(("M", (49, 68)), ("Q", (54, 72), (59, 68))), "trait", width=1.8, passes=1)


def p23_ahri(c):
    ombre(c, 54, 85, 20)
    for sgn in (-1, 1):
        oreille = [(54 + sgn * 9, 40), (54 + sgn * 24, 14), (54 + sgn * 29, 46)]
        c.remplir(oreille, "orange")
        c.trait(oreille, "trait", close=True, width=2.6)
        c.remplir([(54 + sgn * 13, 38), (54 + sgn * 23, 23), (54 + sgn * 26, 42)], "rouge")
    moitie = [(54, 34), (66, 35), (77, 46), (73, 64), (62, 75), (54, 80)]
    tete = moitie + miroir(moitie)
    c.remplir(tete, "page")
    c.hachures(moitie + [(54, 34)], "orange.h", spacing=3.6, angle=-40, width=1.1)
    c.trait(tete, "trait", close=True, width=2.8)
    for sgn in (-1, 1):
        c.remplir(chemin(("M", (54 + sgn * 6, 52)), ("Q", (54 + sgn * 12, 47), (54 + sgn * 19, 52)), ("Q", (54 + sgn * 12, 56), (54 + sgn * 6, 52))), "trait")
        for dy in (-3, 1, 5):  # marques de joues
            c.ligne((54 + sgn * 22, 60 + dy), (54 + sgn * 15, 61 + dy), "rouge.h", width=2.0, passes=1)
    c.remplir([(51, 64), (57, 64), (54, 68)], "trait")
    c.trait(chemin(("M", (54, 68)), ("L", (54, 71)), ("M", (48, 72)), ("Q", (54, 75), (60, 72)))[:3] + [(54, 71)], "trait", width=1.8, passes=1)
    orbe = cercle(80, 72, 6.5, 18)
    c.remplir(orbe, "rouge")
    c.trait(orbe, "trait", close=True, width=2.2)
    c.remplir(cercle(78, 70, 1.6, 8), "page")


def p24_thresh(c):
    ombre(c, 54, 86, 17)
    c.trait(ellipse(54, 14, 4.5, 4.5, 0, 0, 360, 14), "trait", close=True, width=2.4)
    for y in (22, 27):
        c.trait(ellipse(54, y, 2.4, 3.2, 0, 0, 360, 10), "trait", close=True, width=1.8, passes=1)
    toit = [(42, 36), (46, 31), (62, 31), (66, 36)]
    c.remplir(toit, "gris")
    c.trait(toit, "trait", close=True, width=2.4)
    c.trait(ellipse(54, 30, 6, 2.6, 0, 180, 360, 10), "trait", width=2.2)
    cage = [(40, 36), (68, 36), (66, 68), (42, 68)]
    c.remplir(cage, "vert")
    c.hachures([(54, 36), (68, 36), (66, 68), (54, 68)], "vert.h", spacing=3.2, angle=-40)
    flamme = chemin(("M", (54, 62)), ("Q", (45, 56), (50, 48)), ("Q", (52, 52), (54, 42)), ("Q", (60, 50), (62, 56)), ("Q", (62, 62), (54, 62)))
    c.remplir(flamme, "jaune")
    c.trait(flamme, "trait", close=True, width=1.8, passes=1)
    c.trait(cage, "trait", close=True, width=2.8)
    for x in (47.5, 54, 60.5):
        c.ligne((x - (54 - x) * 0.05, 36), (x, 68), "trait", width=1.8, passes=1)
    base = [(38, 68), (70, 68), (66, 76), (42, 76)]
    c.remplir(base, "gris")
    c.trait(base, "trait", close=True, width=2.6)


def p25_lux(c):
    ombre(c, 54, 86, 20)
    halo = etoile_pts(54, 52, 34, 14, 8)
    c.remplir(halo, "or")
    c.hachures(halo, "or.h", spacing=3.4, angle=-40)
    c.trait(halo, "trait", close=True, width=2.8)
    petit = etoile_pts(54, 52, 22, 9, 4, rot=-45)
    c.remplir(petit, "page")
    c.trait(petit, "trait", close=True, width=2.0, passes=1)
    centre = cercle(54, 52, 8.5, 20)
    c.remplir(centre, "bleu")
    c.hachures(centre, "bleu.h", spacing=2.6, angle=-40, width=1.1)
    c.trait(centre, "trait", close=True, width=2.4)


def p26_yuumi(c):
    ombre(c, 54, 85, 20)
    for sgn in (-1, 1):
        oreille = [(54 + sgn * 10, 40), (54 + sgn * 21, 16), (54 + sgn * 30, 42)]
        c.remplir(oreille, "violet")
        c.trait(oreille, "trait", close=True, width=2.6)
        c.remplir([(54 + sgn * 14, 38), (54 + sgn * 21, 24), (54 + sgn * 26, 40)], "rouge")
    tete = ellipse(54, 56, 28, 22, 0, 0, 360, 40)
    c.remplir(tete, "page")
    c.hachures(ellipse(54, 56, 28, 22, 0, -90, 90, 20) + [(54, 56)], "violet.h", spacing=3.6, angle=-40, width=1.1)
    c.trait(tete, "trait", close=True, width=2.8)
    for sgn in (-1, 1):
        oeil = ellipse(54 + sgn * 11, 54, 6, 7.5, 0, 0, 360, 20)
        c.remplir(oeil, "bleu")
        c.trait(oeil, "trait", close=True, width=2.0)
        c.remplir(cercle(54 + sgn * 11, 55, 3.2, 10), "trait")
        c.remplir(cercle(54 + sgn * 11 - 1.5, 52, 1.5, 8), "page")
        for dy in (-1, 4):
            c.ligne((54 + sgn * 25, 62 + dy), (54 + sgn * 36, 60 + dy * 1.6), "trait", width=1.6, passes=1)
    c.remplir([(51, 62), (57, 62), (54, 66)], "rouge")
    c.trait([(51, 62), (57, 62), (54, 66)], "trait", close=True, width=1.6, passes=1)
    c.trait(chemin(("M", (54, 66)), ("Q", (50, 71), (46, 68))), "trait", width=1.8, passes=1)
    c.trait(chemin(("M", (54, 66)), ("Q", (58, 71), (62, 68))), "trait", width=1.8, passes=1)


def p27_zed(c):
    ombre(c, 54, 86, 20)
    pts = etoile_pts(54, 52, 36, 9, 4, rot=-90)
    c.remplir(pts, "gris")
    c.hachures(pts, "gris.h", spacing=3.0, angle=-40)
    c.trait(pts, "trait", close=True, width=3.0)
    anneau = cercle(54, 52, 9, 24)
    c.remplir(anneau, "rouge")
    c.trait(anneau, "trait", close=True, width=2.6)
    trou = cercle(54, 52, 4, 14)
    c.remplir(trou, "page")
    c.trait(trou, "trait", close=True, width=2.0)
    for k in range(4):  # tranchants
        a = math.radians(-90 + 90 * k)
        c.ligne((54 + 12 * math.cos(a), 52 + 12 * math.sin(a)), (54 + 30 * math.cos(a), 52 + 30 * math.sin(a)), "trait", width=1.5, passes=1)


def p28_amumu(c):
    ombre(c, 54, 85, 19)
    for sgn in (-1, 1):
        oreille = [(54 + sgn * 17, 40), (54 + sgn * 26, 28), (54 + sgn * 25, 46)]
        c.remplir(oreille, "page")
        c.trait(oreille, "trait", close=True, width=2.4)
    tete = ellipse(54, 54, 25, 24, 0, 0, 360, 40)
    c.remplir(tete, "page")
    c.hachures(ellipse(54, 54, 25, 24, 0, -90, 90, 20) + [(54, 54)], "brun.h", spacing=3.6, angle=-40, width=1.1)
    c.trait(tete, "trait", close=True, width=2.8)
    for y in (36, 70):  # bandages
        c.trait(chemin(("M", (32, y - 1)), ("Q", (54, y + (5 if y < 50 else -5)), (76, y - 1))), "trait", width=2.2, passes=1)
    c.trait([(60, 30), (76, 56)], "trait", width=2.0, passes=1)
    c.trait([(34, 74), (50, 64)], "trait", width=2.0, passes=1)
    for sgn in (-1, 1):
        oeil = ellipse(54 + sgn * 10, 55, 5.6, 7.4, 0, 0, 360, 20)
        c.remplir(oeil, "trait")
        c.remplir(cercle(54 + sgn * 10 - 1.6, 52, 1.9, 8), "page")
    c.remplir(ellipse(64, 66, 2.0, 3.4), "bleu")
    c.trait(chemin(("M", (50, 66)), ("Q", (54, 64), (58, 66))), "trait", width=1.8, passes=1)


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
    ("qwer", "Touches QWER", p11_qwer),
    ("baron", "Baron Nashor", p12_baron),
    ("dragon", "Dragon", p13_dragon),
    ("couronne", "Couronne", p14_couronne),
    ("orbe", "Boule de cristal", p15_orbe),
    ("heaume", "Heaume", p16_heaume),
    ("minion", "Minion mage", p17_minion),
    ("ecran", "Écran de match", p18_ecran),
    ("baron-oeil", "Baron : l'œil", p19_baron_oeil),
    ("baron-crocs", "Baron : la gueule", p20_baron_crocs),
    ("baron-tentacule", "Baron : tentacule", p21_baron_tentacule),
    ("teemo", "Teemo : le champignon", p22_teemo),
    ("ahri", "Ahri : le renard", p23_ahri),
    ("thresh", "Thresh : la lanterne", p24_thresh),
    ("lux", "Lux : l'éclat de lumière", p25_lux),
    ("yuumi", "Yuumi : la chatte", p26_yuumi),
    ("zed", "Zed : le shuriken", p27_zed),
    ("amumu", "Amumu : le petit momie", p28_amumu),
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
