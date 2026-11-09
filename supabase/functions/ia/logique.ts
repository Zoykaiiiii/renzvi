// La logique de la fonction « ia », séparée de Deno.serve pour être testée. Ordre : session vérifiée, entrée bornée,
// crédits réservés en base (ia_reserver), appel au fournisseur avec délai et nouvelles tentatives bornées, puis
// ia_terminer qui garde le résultat ou rend les crédits. La dépense fournisseur est comptée même en cas d'échec.
import { ErreurFournisseur, type Fournisseur } from './fournisseur.ts';
import { valider, SortieInvalide } from './valider.ts';

export type Base = {
  reserver(user: string, travail: string, type: string, caracteres: number, cle: string | null): Promise<Record<string, unknown>>;
  terminer(travail: string, etat: string, resultat: unknown, depense: number, erreur: string | null, tentatives: number): Promise<unknown>;
};
export type Outils = { utilisateur(jeton: string): Promise<string | null>; base: Base; fournisseur: Fournisseur; delaiMs?: number; pauseMs?: number };

const TYPES = new Set(['cartes', 'resume', 'expliquer', 'quiz']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TENTATIVES = 3;
export const reponse = (statut: number, corps: unknown) => new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json', ...ENTETES } });
export const ENTETES = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS' };

export async function traiter(req: Request, o: Outils): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: ENTETES });
  if (req.method !== 'POST') return reponse(405, { ok: false, raison: 'methode' });
  const jeton = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const user = jeton ? await o.utilisateur(jeton) : null;
  if (!user) return reponse(401, { ok: false, raison: 'session' });

  let corps: Record<string, unknown>;
  try { corps = await req.json(); } catch { return reponse(400, { ok: false, raison: 'entree' }); }
  // Le navigateur n'envoie ni prix, ni solde, ni utilisateur : seulement le travail demandé. Le reste est ignoré.
  const { travail, type, texte, consigne, cle } = corps;
  if (typeof travail !== 'string' || !UUID.test(travail) || typeof type !== 'string' || !TYPES.has(type) || typeof texte !== 'string' || !texte.trim()
    || (consigne != null && (typeof consigne !== 'string' || consigne.length > 500)) || (cle != null && (typeof cle !== 'string' || cle.length > 200))) return reponse(400, { ok: false, raison: 'entree' });

  const reserve = await o.base.reserver(user, travail, type, texte.length, (cle as string | undefined) ?? null);
  if (!reserve.ok || reserve.deja) return reponse(reserve.ok ? 200 : 409, reserve);

  let depense = 0, essai = 0, derniere = 'echec';
  while (essai < TENTATIVES) {
    essai++;
    const signal = AbortSignal.timeout(o.delaiMs ?? 30_000);
    try {
      const course = o.fournisseur.generer({ type, texte, consigne: consigne as string | undefined }, signal);
      // Le délai coupe l'attente même si le fournisseur n'écoute pas le signal.
      const r = await Promise.race([course, new Promise<never>((_, ko) => signal.addEventListener('abort', () => ko(new ErreurFournisseur('délai dépassé', true))))]);
      depense += r.depenseCentimes;
      // Une sortie mal formée ne sera pas meilleure au prochain essai : le travail échoue et les crédits sont rendus.
      let propre;
      try { propre = valider(type, r.sortie, texte); } catch (e) {
        if (!(e instanceof SortieInvalide)) throw e;
        derniere = `sortie invalide : ${e.message}`;
        break;
      }
      await o.base.terminer(travail, 'reussi', propre, depense, null, essai);
      return reponse(200, { ok: true, travail, credits: reserve.credits, solde: reserve.solde, resultat: propre });
    } catch (e) {
      const err = e instanceof ErreurFournisseur ? e : new ErreurFournisseur(String((e as Error)?.message ?? e), false);
      depense += err.depenseCentimes;
      derniere = err.message;
      if (!err.reessayable) break;
      if (essai < TENTATIVES) await new Promise(ok => setTimeout(ok, (o.pauseMs ?? 800) * essai));
    }
  }
  await o.base.terminer(travail, 'echoue', null, depense, derniere, essai);
  return reponse(502, { ok: false, raison: 'fournisseur', travail, rembourse: true });
}
