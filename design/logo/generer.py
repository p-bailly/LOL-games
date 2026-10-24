"""Logo « au crayon » de LoL Live : la tête du Baron Nashor.

Style commun des applis (LoL Live, Basket Live, Scan, Météo, Nimbus, Mes applis), repris du logo de Météo
(p-bailly/Meteo, design/logos/crayon/generer.py) : papier crème, contours au graphite repassés deux fois avec un léger
tremblé, un crayon de couleur par appli (aplat léger puis hachures appuyées), ombres hachurées. Le tremblé est tiré au
hasard mais reproductible : modifier le script puis le relancer.

Écrit design/logo/logo.svg (grille de l'icône adaptative, 108 × 108, dessin dans le cercle sûr de 66) et les calques
de l'icône adaptative Android (android/…/res/drawable/ic_launcher_foreground.xml et
ic_launcher_monochrome.xml), ainsi que public/icon.svg pour l'app web. Les PNG (anciennes icônes
Android, icônes de l'app web, écrans de démarrage) se refont ensuite avec design/logo/png.cjs. Le fond de l'icône est la couleur ic_launcher_background, le papier.
Lancer : python3 design/logo/generer.py"""
import math
import os
import random
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DRAWABLE = os.path.join(HERE, "..", "..", "android", "app", "src", "main", "res", "drawable")

# Palette commune : papier, graphite, blanc, et un crayon par appli (aplat léger, hachure appuyée).
PAPIER = "#F6F1E6"
GRAPHITE = "#2E3644"
BLANC = "#FFFDF8"
CRAYONS = {
    "orange": ("#F4A261", "#D9622B"),  # Basket Live
    "sarcelle": ("#93D3C6", "#2A9D8F"),  # Scan
    "jaune": ("#F0B429", "#E07A2E"),  # Météo
    "bleu": ("#8BB8DE", "#3E7CB8"),  # Nimbus
    "vert": ("#A8D08D", "#4F9A45"),  # Mes applis
    "or": ("#EBD38E", "#C89B3C"),  # (piste cristal)
    "violet": ("#C9BBEA", "#7A5BC4"),  # LoL Live (le Baron)
    "rouge": ("#F2A59E", "#D6453D"),
}
ROLES = {"trait": GRAPHITE, "ombre": GRAPHITE, "fond": PAPIER, "nuage": PAPIER, "page": BLANC}


def couleur(nom):
    """Couleur d'un rôle (« trait », « page »…) ou d'un crayon : « bleu » pour l'aplat, « bleu.h » pour la hachure."""
    if nom in ROLES:
        return ROLES[nom]
    base, _, h = nom.partition(".")
    return CRAYONS[base][1 if h else 0]


class Crayon:
    """Le dessin, gardé en éléments (sorte, chemin, couleur, alpha, épaisseur, découpe) pour l'écrire en SVG ou en
    vector drawable Android."""

    def __init__(self, seed):
        self.rnd = random.Random(seed)
        self.elements = []

    def j(self, a):
        return (self.rnd.random() * 2 - 1) * a

    def trait(self, pts, color, width=2.6, close=False, passes=2, wobble=0.35, opacity=1.0):
        for p in range(passes):
            q = [(x + self.j(wobble), y + self.j(wobble)) for x, y in pts]
            d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in q) + (" Z" if close else "")
            op = (1 if p == 0 else 0.55) * opacity
            w = width if p == 0 else width * 0.7
            self.elements.append(("trait", d, color, round(op, 2), round(w, 2), None))

    def ligne(self, a, b, color, width=2.6, passes=2, opacity=1.0):
        pts = [(a[0] + (b[0] - a[0]) * t / 5, a[1] + (b[1] - a[1]) * t / 5) for t in range(6)]
        self.trait(pts, color, width, passes=passes, wobble=0.5, opacity=opacity)

    def remplir(self, pts, color, opacity=1.0):
        d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"
        self.elements.append(("aplat", d, color, opacity, None, None))

    def gomme(self, pts, width):
        """Réserve autour d'un trait qui passe devant un autre dessin : un trait épais couleur du fond."""
        d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts)
        self.elements.append(("gomme", d, "fond", 1, width, None))

    def hachures(self, pts, color, spacing=4.0, angle=-35, width=1.5):
        d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        r = math.hypot(max(xs) - min(xs), max(ys) - min(ys)) / 2 + 2
        a = math.radians(angle)
        ux, uy = math.cos(a), math.sin(a)
        lines = []
        k = -r
        while k <= r:
            ox, oy = cx - uy * k, cy + ux * k
            p1 = (ox - ux * r + self.j(1), oy - uy * r + self.j(1))
            p2 = (ox + ux * r + self.j(1), oy + uy * r + self.j(1))
            lines.append(f"M{p1[0]:.1f} {p1[1]:.1f} L{p2[0]:.1f} {p2[1]:.1f}")
            k += spacing + self.j(0.6)
        self.elements.append(("trait", " ".join(lines), color, 0.85, width, d))

    def svg(self, label, view="0 0 108 108", coins=0):
        """Le logo en SVG sur son papier ; coins : rayon des coins arrondis, 0 pour un carré."""
        defs, parts = [], []
        for i, (sorte, d, color, alpha, width, clip) in enumerate(self.elements):
            col = couleur(color)
            if sorte == "aplat":
                op = f' fill-opacity="{alpha}"' if alpha < 1 else ""
                parts.append(f'<path d="{d}" fill="{col}"{op}/>')
                continue
            attrs = f'fill="none" stroke="{col}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"'
            if alpha < 1:
                attrs += f' stroke-opacity="{alpha}"'
            if clip:
                defs.append(f'<clipPath id="h{i}"><path d="{clip}"/></clipPath>')
                attrs += f' clip-path="url(#h{i})"'
            parts.append(f'<path d="{d}" {attrs}/>')
        x, y, w, h = view.split()
        if coins:
            defs.append(f'<clipPath id="coins"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{coins}"/></clipPath>')
            parts = ['<g clip-path="url(#coins)">', f'<rect width="108" height="108" fill="{PAPIER}"/>'] + parts + ["</g>"]
        else:
            parts.insert(0, f'<rect width="108" height="108" fill="{PAPIER}"/>')
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" role="img" aria-label="{label}">\n'
                f'  <defs>{"".join(defs)}</defs>\n  ' + "\n  ".join(parts) + "\n</svg>\n")

    def drawable(self, commentaire, monochrome=False):
        """Calque de premier plan de l'icône adaptative Android, sans le fond. En monochrome (icônes à thème
        d'Android 13+), seul l'alpha compte : tout est tracé en noir, et les aplats et les réserves, qui ne font que
        masquer, sont omis."""
        def vd(d):
            return re.sub(r"(-?[\d.]+) (-?[\d.]+)", r"\1,\2", d).replace(" ", "")

        out = []
        for sorte, d, color, alpha, width, clip in self.elements:
            if monochrome and sorte in ("aplat", "gomme"):
                continue
            if sorte == "aplat":
                op = f'\n        android:fillAlpha="{alpha}"' if alpha < 1 else ""
                out.append(f'    <path\n        android:fillColor="{couleur(color)}"{op}\n'
                           f'        android:pathData="{vd(d)}" />')
                continue
            path = (f'<path\n        android:strokeColor="{"#000000" if monochrome else couleur(color)}"\n'
                    f'        android:strokeAlpha="{alpha}"\n        android:strokeWidth="{width}"\n'
                    f'        android:strokeLineCap="round"\n        android:strokeLineJoin="round"\n'
                    f'        android:pathData="{vd(d)}" />')
            if clip:
                path = path.replace("\n        ", "\n            ")
                out.append(f'    <group>\n        <clip-path android:pathData="{vd(clip)}" />\n        {path}\n    </group>')
            else:
                out.append("    " + path)
        return ('<?xml version="1.0" encoding="utf-8"?>\n<!--\n' + commentaire + '\n-->\n'
                '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
                '    android:width="108dp"\n    android:height="108dp"\n'
                '    android:viewportWidth="108"\n    android:viewportHeight="108">\n'
                + "\n".join(out) + "\n</vector>\n")


def cercle(cx, cy, r, n=36):
    return [(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for k in range(n)]


def ellipse(cx, cy, rx, ry, rot=0, t0=0, t1=360, n=36):
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    out = []
    for k in range(n + 1):
        t = math.radians(t0 + (t1 - t0) * k / n)
        x, y = rx * math.cos(t), ry * math.sin(t)
        out.append((cx + x * c - y * s, cy + x * s + y * c))
    return out


def courbe(p0, p1, p2, n=10):
    """Courbe de Bézier quadratique, en points."""
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in (k / n for k in range(n + 1))]


def chemin(*items):
    """Points d'un chemin : ('M', p), ('L', p), ('Q', ctrl, p)."""
    pts = []
    for it in items:
        if it[0] in "ML":
            pts.append(it[1])
        else:
            pts += courbe(pts[-1], it[1], it[2])[1:]
    return pts


def cadrer(c, rayon=33.0, centre=(54.0, 54.0)):
    """Centre le dessin et le réduit au besoin pour qu'il tienne dans le cercle sûr de l'icône adaptative Android
    (66 sur la grille de 108). Les hachures débordent de leur forme : on mesure la forme (le découpage)."""
    pair = re.compile(r"(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)")
    xs, ys = [], []
    for _sorte, d, _col, _alpha, _width, clip in c.elements:
        for x, y in pair.findall(clip or d):
            xs.append(float(x))
            ys.append(float(y))
    mx, my = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    k = min(1.0, rayon / max(math.hypot(x - mx, y - my) for x, y in zip(xs, ys)))
    tr = lambda txt: pair.sub(lambda m: f"{(float(m[1]) - mx) * k + centre[0]:.1f} {(float(m[2]) - my) * k + centre[1]:.1f}", txt)
    c.elements = [(a, tr(d), col, al, w, tr(cl) if cl else cl) for a, d, col, al, w, cl in c.elements]


def dessin(c):
    """Le Baron Nashor : une tête violette hérissée de pointes, des yeux jaunes à pupille fendue, une gueule à crocs."""
    c.hachures(ellipse(54, 86, 22, 2.8), "ombre", spacing=2.4, angle=-20, width=1.0)
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


if __name__ == "__main__":
    c = Crayon(11)
    dessin(c)
    cadrer(c)
    with open(os.path.join(HERE, "logo.svg"), "w") as out:
        out.write(c.svg("LoL Live : le Baron Nashor"))
    note = ("    Logo au crayon (design/logo/logo.svg), généré par design/logo/generer.py : ne pas modifier à la main.\n"
            f"    Fond : ic_launcher_background {PAPIER}.")
    with open(os.path.join(DRAWABLE, "ic_launcher_foreground.xml"), "w") as out:
        out.write(c.drawable(note))
    with open(os.path.join(DRAWABLE, "ic_launcher_monochrome.xml"), "w") as out:
        out.write(c.drawable(note + "\n    Calque monochrome des icônes à thème d'Android 13+.", monochrome=True))
    # Icône de l'app web (onglet du navigateur, écran d'accueil) : la zone visible de l'icône, coins arrondis.
    with open(os.path.join(HERE, "..", "..", "public", "icon.svg"), "w") as out:
        out.write(c.svg("LoL Live : le Baron Nashor", view="18 18 72 72", coins=15.75))
