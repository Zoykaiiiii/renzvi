"""Import des recettes du « Livre de cuisine » de Wikibooks (fr) vers site/nutrition/recettes.json.

Source : https://fr.wikibooks.org/wiki/Livre_de_cuisine, textes sous licence CC BY-SA 4.0.
Obligations : citer la page source (lien) et la licence sur chaque fiche ; le fichier produit reste sous CC BY-SA.
On ne prend ni les images (licences propres à chaque fichier), ni les boissons et cocktails.

Lancement (relançable, le même résultat pour les mêmes pages) :
  python3 outils/recettes_wikibooks.py                 # télécharge puis convertit
  python3 outils/recettes_wikibooks.py brut.json       # convertit une copie déjà téléchargée
Auto-vérification des fonctions d'analyse : python3 outils/recettes_wikibooks.py --test
"""
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://fr.wikibooks.org/w/api.php"
UA = {"User-Agent": "RenzviRecipeImport/0.1 (import ponctuel, licence CC BY-SA respectee)"}
SORTIE = Path(__file__).resolve().parent.parent / "site" / "nutrition" / "recettes.json"

BOISSONS = {"cocktails alcoolisés", "cocktails", "boissons", "cocktails sans alcool", "vodka", "whisky", "anis",
            "thé", "café", "rhum", "gin", "tequila", "bières", "vins", "liqueurs", "smoothies", "jus de fruits"}
TYPES = [  # premier qui correspond
    ("dessert", {"desserts", "pâtisseries", "recettes de gâteaux", "tartes sucrées", "biscuits", "confitures",
                 "recettes de cuisine à base de chocolat", "crêpes", "glaces"}),
    ("entree", {"entrées", "soupes", "salades", "amuse bouches", "tapas", "apéritifs"}),
    ("accompagnement", {"accompagnements", "sauces"}),
    ("plat", {"plat principal", "viande", "recettes de cuisine à base de viande", "recettes de cuisine à base de poisson",
              "pâtes alimentaires", "pâtes", "recettes de pizzas", "fondues", "recettes de cuisine à base de riz",
              "sandwiches", "recettes de tous les jours", "galettes"}),
]
QUANTITE = re.compile(r"""^\s*(?:env(?:iron)?\.?\s*)?(?:[\d½¼¾⅓⅔/.,\s-]+|un|une|deux|trois|quatre|cinq|six|quelques|une\s+dizaine)\s*""", re.I)
UNITES = re.compile(r"""^(?:k?g|mg|grammes?|kilos?|c?l|ml|dl|litres?|cuill[eè]res?(?:\s+[àa]\s+(?:soupe|caf[ée]))?|c\.?\s*[àa]\s*[sc]\.?|cs|cc|
    pinc[ée]es?|gousses?|tranches?|sachets?|verres?|bols?|tasses?|bottes?|brins?|feuilles?|morceaux?|bo[iî]tes?|pots?|
    poign[ée]es?|noix|noisettes?|filets?|branches?|bouquets?|t[êe]tes?|zestes?|rondelles?|tiges?|cubes?|briques?|paquets?|
    petite?s?|grande?s?|grosse?s?|bonne?s?|belle?s?|demi|moyens?|moyennes?)\b\.?\s*""", re.I | re.X)
FACULTATIF = re.compile(r"facultati|optionnel|selon (?:les|vos|tes) go[uû]ts|si d[ée]sir|si on veut|pour d[ée]corer", re.I)


def sans_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def params(inner):
    """Découpe le contenu d'un modèle {{…}} au premier niveau (les | dans [[…]] ou {{…}} imbriqués restent)."""
    out, cur, depth = [], "", 0
    for i, ch in enumerate(inner):
        if inner.startswith(("{{", "[["), i):
            depth += 1
        elif inner.startswith(("}}", "]]"), i) and depth:
            depth -= 1
        if ch == "|" and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return [p.strip() for p in out]


def modeles(text):
    """Liste (début, fin, contenu) des modèles {{…}} de premier niveau."""
    res, i = [], 0
    while (i := text.find("{{", i)) != -1:
        depth, j = 0, i
        while j < len(text):
            if text.startswith("{{", j):
                depth += 1
                j += 2
            elif text.startswith("}}", j):
                depth -= 1
                j += 2
                if depth == 0:
                    break
            else:
                j += 1
        res.append((i, j, text[i + 2:j - 2]))
        i = j
    return res


def texte(wiki):
    """Wikitexte d'une ligne vers texte simple."""
    s = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>|<!--.*?-->", "", wiki, flags=re.S)
    out, last = "", 0
    for a, b, inner in modeles(s):
        out += s[last:a]
        p = params(inner)
        nom = p[0].lower()
        pos = [x for x in p[1:] if "=" not in x.split("[[")[0]]
        if nom in ("i", "w", "lien", "ingrédient") and pos:
            out += pos[-1]
        elif nom in ("unité", "nombre", "nb", "formatnum") and pos:
            out += " ".join(pos)
        elif nom in ("°c", "°"):
            out += "°C"
        last = b
    s = out + s[last:]
    s = re.sub(r"\[\[(?:Image|Fichier|File|Cat[ée]gorie|Category):[^\]]*\]\]", "", s, flags=re.I)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"\[https?://\S+\s+([^\]]+)\]", r"\1", s)
    s = re.sub(r"\[https?://\S+\]", "", s)
    s = re.sub(r"'{2,}", "", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("&nbsp;", " ").replace("’", "'")
    return re.sub(r"\s+", " ", s).strip(" :;")


def cle(nom):
    """Nom d'ingrédient normalisé : minuscules, apostrophe droite, singulier simple. Les accents restent pour l'affichage."""
    s = nom.lower().replace("’", "'").strip(" .,:;*")
    s = re.sub(r"^(?:(?:de la|des|du|de|la|le|les|un|une)\s+|de l'|d'|l')", "", s)
    s = re.sub(r"\s*\(.*$", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    mots = []
    for m in s.split(" "):
        if len(m) > 3 and m.endswith(("s", "x")) and not m.endswith(("ss", "us", "is", "as", "os", "ix")):
            m = m[:-1]
        mots.append(m)
    s = " ".join(mots)
    return s if 2 <= len(s) <= 40 else None


def cles_balisees(wiki):
    """Clés des ingrédients balisés {{i|…}} et des liens [[…]] d'une ligne."""
    ks = []
    for _, _, inner in modeles(wiki):
        p = params(inner)
        if p[0].lower() in ("i", "ingrédient"):
            pos = [x for x in p[1:] if "=" not in x]
            if pos:
                ks.append(cle(texte(pos[0])))
    for cible in re.findall(r"\[\[(?:w:)?([^|\]:]+)(?:\|[^\]]*)?\]\]", wiki):
        ks.append(cle(cible))
    return [k for k in dict.fromkeys(ks) if k]


def cle_devinee(ligne):
    """Pour une recette sans balises : retire quantité et unité, garde le nom (« 200 g de farine » → farine)."""
    s = QUANTITE.sub("", ligne)
    for _ in range(3):
        s = UNITES.sub("", s)
    s = re.split(r",| ou | pour | et | \(|:| à | \+ ", s)[0]
    return cle(" ".join(s.split()[:4]))


def sections(wiki):
    """{titre normalisé: lignes} pour chaque titre, quel que soit son niveau (== à ====).
    Une section va jusqu'au titre suivant de même niveau ou plus haut : ses sous-titres restent dedans."""
    lignes = wiki.splitlines()
    titres = [(i, len(m.group(1)), m.group(2)) for i, l in enumerate(lignes) if (m := re.match(r"^(=+)\s*(.*?)\s*=+\s*$", l))]
    res = {}
    for n, (i, niveau, titre) in enumerate(titres):
        fin = next((j for j, nv, _ in titres[n + 1:] if nv <= niveau), len(lignes))
        res.setdefault(sans_accents(texte(titre)).lower(), lignes[i + 1:fin])
    return res


def recette(titre, wiki, rev):
    nom = titre.split("/", 1)[1]
    cats = {c.strip().lower() for c in re.findall(r"\[\[\s*Cat[ée]gorie\s*:\s*([^|\]]+)", wiki, re.I)}
    if "/" in nom or nom.startswith(("Cuisine ", "Recettes ")) or cats & BOISSONS or wiki.lstrip().upper().startswith("#REDIRECT"):
        return None
    sec = sections(wiki)
    ing_l = next((v for k, v in sec.items() if k.startswith("ingredient")), None)
    prep_l = next((v for k, v in sec.items() if k.startswith(("preparation", "realisation", "recette", "etapes"))), None)
    if not ing_l or not prep_l:
        return None
    balise = wiki.count("{{i|") >= 2
    ing, portions = [], None
    for line in ing_l:
        m = re.match(r"^(=+)\s*(.*?)\s*=+\s*$", line)
        if m:
            g = texte(m.group(2))
            if g:
                ing.append({"g": g})
            continue
        if not portions:
            p = re.search(r"pour\s+(\d+(?:\s*(?:à|-)\s*\d+)?)\s+(personnes?|parts?|portions?|pi[eè]ces?|bocaux?|verrines?)", texte(line), re.I)
            if p:
                portions = f"{p.group(1)} {p.group(2).lower()}"
        if not line.lstrip().startswith(("*", "#")):
            continue
        x = texte(line.lstrip("*#: "))
        if not x:
            continue
        ks = cles_balisees(line) if balise else [k for k in [cle_devinee(x)] if k]
        item = {"x": x[:200], "k": ks}
        if FACULTATIF.search(x):
            item["f"] = 1
        ing.append(item)
    etapes = []
    for line in prep_l:
        if re.match(r"^=+.*=+\s*$", line):
            g = texte(line.strip("= "))
            if g:
                etapes.append({"g": g})
            continue
        x = texte(line.lstrip("*#: "))
        if x and not x.lower().startswith(("catégorie", "category")):
            etapes.append(x[:600])
    vraies = [i for i in ing if "x" in i]
    if len(vraies) < 2 or not any(isinstance(e, str) for e in etapes):
        return None
    ty = next((t for t, s in TYPES if cats & s), None)
    origine = sorted(c[len("cuisine "):] for c in cats if c.startswith("cuisine ") and len(c) < 40)
    r = {
        "id": re.sub(r"[^a-z0-9]+", "-", sans_accents(nom).lower()).strip("-"),
        "t": nom,
        "rev": rev,
        "ing": ing[:60],
        "et": etapes[:60],
    }
    if portions:
        r["p"] = portions
    if ty:
        r["ty"] = ty
    if "recettes végétaliennes" in cats:
        r["veg"] = 2
    elif "recettes végétariennes" in cats:
        r["veg"] = 1
    if origine:
        r["o"] = origine[:3]
    return r


def telecharger():
    def appel(p):
        p["format"] = "json"
        for _ in range(8):
            try:
                req = urllib.request.Request(API, data=urllib.parse.urlencode(p).encode(), headers=UA)
                return json.load(urllib.request.urlopen(req, timeout=60))
            except urllib.error.HTTPError as e:
                if e.code != 429:
                    raise
                time.sleep(int(e.headers.get("Retry-After") or 20))
        raise SystemExit("Wikibooks refuse les requêtes (429), réessaie plus tard.")
    titres, suite = [], {}
    while True:
        d = appel(dict(action="query", list="allpages", apprefix="Livre de cuisine/", apnamespace=0, aplimit=500,
                       apfilterredir="nonredirects", **suite))
        titres += [x["title"] for x in d["query"]["allpages"]]
        if "continue" not in d:
            break
        suite = {"apcontinue": d["continue"]["apcontinue"]}
    brut = {}
    for i in range(0, len(titres), 50):
        d = appel(dict(action="query", prop="revisions", rvprop="content|ids", rvslots="main", formatversion=2,
                       titles="|".join(titres[i:i + 50])))
        for pg in d["query"]["pages"]:
            if "revisions" in pg:
                r = pg["revisions"][0]
                brut[pg["title"]] = {"rev": r["revid"], "text": r["slots"]["main"]["content"]}
        time.sleep(3)
    return brut


def convertir(brut):
    out, vus = [], set()
    for titre in sorted(brut):
        r = recette(titre, brut[titre]["text"], brut[titre]["rev"])
        if r and r["id"] not in vus:
            vus.add(r["id"])
            out.append(r)
    return out


def auto_test():
    assert cle("Tomates") == "tomate" and cle("de la farine") == "farine" and cle("riz") == "riz"
    assert cle("lait") == "lait" and cle("levure") == "levure" and cle("laurier") == "laurier"
    assert cle("noix") == "noix" and cle("ananas") == "ananas" and cle("pommes de terre") == "pomme de terre"
    assert cle_devinee("200 g de farine") == "farine"
    assert cle_devinee("2 cuillères à soupe d'huile d'olive") == "huile d'olive"
    assert cle_devinee("3 gousses d'ail") == "ail"
    assert cles_balisees("* 2 {{i|poivron}}s : un rouge") == ["poivron"]
    assert cles_balisees("* 2 {{i|'=oui|oignon|oignons}}") == ["oignon"]
    assert cles_balisees("* 400 g d’ [[w:Épinard|épinards]]") == ["épinard"]
    assert texte("6 {{i|tomate|tomates}}") == "6 tomates"
    assert texte("Faire revenir avec [[huile d'olive]] '''chaude'''") == "Faire revenir avec huile d'olive chaude"
    wiki = """{{livre de cuisine}}
==Ingrédients==
Pour 4 personnes :
* 1 {{i|poulet}}
* 6 {{i|tomate|tomates}}
* {{i|persil}} (facultatif)
== Préparation ==
* Découper le poulet
* Cuire 1 heure
[[Catégorie:Plat principal]]
[[Catégorie:Cuisine française]]"""
    r3 = recette("Livre de cuisine/Sauce test", wiki.replace("==Ingrédients==", "=== Ingrédients ===").replace("== Préparation ==", "=== Préparation ==="), 1)
    assert r3 and len(r3["ing"]) == 3 and len(r3["et"]) == 2, r3
    r = recette("Livre de cuisine/Poulet test", wiki, 1)
    assert r["id"] == "poulet-test" and r["p"] == "4 personnes" and r["ty"] == "plat" and r["o"] == ["française"], r
    assert [i["k"] for i in r["ing"]] == [["poulet"], ["tomate"], ["persil"]] and r["ing"][2]["f"] == 1, r["ing"]
    assert r["et"] == ["Découper le poulet", "Cuire 1 heure"], r["et"]
    assert recette("Livre de cuisine/Mojito", wiki + "\n[[Catégorie:Cocktails alcoolisés]]", 1) is None
    assert recette("Livre de cuisine/Boissons/Lait", wiki, 1) is None
    assert recette("Livre de cuisine/Cuisine algérienne", wiki, 1) is None
    print("auto-test : ok")


if __name__ == "__main__":
    if sys.argv[1:] == ["--test"]:
        auto_test()
        sys.exit()
    brut = json.load(open(sys.argv[1], encoding="utf-8")) if len(sys.argv) > 1 else telecharger()
    recettes = convertir(brut)
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    doc = {"source": "https://fr.wikibooks.org/wiki/Livre_de_cuisine", "licence": "CC BY-SA 4.0",
           "licence_url": "https://creativecommons.org/licenses/by-sa/4.0/deed.fr", "recettes": recettes}
    SORTIE.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(recettes)} recettes écrites dans {SORTIE}")
