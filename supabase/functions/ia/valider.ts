// Vérifie et nettoie la réponse d'un modèle avant de la garder : bon format, tailles bornées, citations retrouvées
// dans le cours. Une citation introuvable n'est pas présentée comme une source : son élément est marqué « source
// absente ». Une sortie illisible fait échouer le travail (crédits rendus).

const replier = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
const court = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

// La position de la citation dans le texte (pour « revoir dans le cours »), ou null si elle n'y est pas.
export function retrouver(texte: string, citation: unknown): { debut: number; longueur: number } | null {
  if (typeof citation !== 'string' || citation.trim().length < 8) return null;
  const c = replier(citation);
  // Le texte replié n'a plus la même longueur : on cherche sur une copie où chaque caractère garde sa position.
  const carte: number[] = [];
  let plie = '';
  let blanc = false;
  for (let i = 0; i < texte.length; i++) {
    let ch = texte[i].normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’']/g, "'");
    if (/\s/.test(ch)) { if (blanc) continue; ch = ' '; blanc = true; } else blanc = false;
    for (const x of ch) { plie += x; carte.push(i); }
  }
  const at = plie.indexOf(c);
  if (at < 0) return null;
  const debut = carte[at], fin = carte[Math.min(carte.length - 1, at + c.length - 1)] + 1;
  return { debut, longueur: fin - debut };
}

export class SortieInvalide extends Error {}

export function valider(type: string, brute: unknown, texte: string) {
  let s: Record<string, unknown>;
  try { s = typeof brute === 'string' ? JSON.parse(brute.replace(/^```(?:json)?\s*|\s*```$/g, '')) : brute as Record<string, unknown>; } catch { throw new SortieInvalide('réponse illisible'); }
  if (!s || typeof s !== 'object') throw new SortieInvalide('réponse vide');
  const source = (citation: unknown) => { const r = retrouver(texte, citation); return r ? { citation: court(citation, 200), ...r } : null; };
  if (type === 'cartes') {
    if (!Array.isArray(s.cartes)) throw new SortieInvalide('cartes absentes');
    const cartes = s.cartes.slice(0, 10).map((c: Record<string, unknown>) => ({ question: court(c?.question, 300), reponse: court(c?.reponse, 600), source: source(c?.citation) })).filter(c => c.question && c.reponse);
    return { cartes };
  }
  if (type === 'resume') {
    if (!Array.isArray(s.points)) throw new SortieInvalide('points absents');
    return { points: s.points.slice(0, 8).map((p: Record<string, unknown>) => ({ texte: court(p?.texte, 400), source: source(p?.citation) })).filter(p => p.texte) };
  }
  if (type === 'quiz') {
    if (!Array.isArray(s.questions)) throw new SortieInvalide('questions absentes');
    const questions = s.questions.slice(0, 8).map((q: Record<string, unknown>) => {
      const choix = Array.isArray(q?.choix) ? q.choix.slice(0, 4).map(c => court(c, 200)).filter(Boolean) : [];
      return { question: court(q?.question, 300), choix, bonne: Number.isInteger(q?.bonne) ? q.bonne as number : -1, explication: court(q?.explication, 400), source: source(q?.citation) };
    }).filter(q => q.question && q.choix.length >= 2 && q.bonne >= 0 && q.bonne < q.choix.length && new Set(q.choix).size === q.choix.length);
    return { questions };
  }
  if (type === 'expliquer') {
    const explication = court(s.explication, 1500);
    if (!explication) throw new SortieInvalide('explication absente');
    const src = source(s.citation);
    // « Dans le cours » seulement si une citation a vraiment été retrouvée.
    return { explication, dans_le_cours: s.dans_le_cours === true && !!src, exemple_exterieur: court(s.exemple_exterieur, 600) || null, source: src };
  }
  throw new SortieInvalide('type inconnu');
}
