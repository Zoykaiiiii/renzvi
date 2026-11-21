// La logique de la fonction « ia », séparée de Deno.serve pour être testée. Ordre : session vérifiée, entrée bornée,
// crédits réservés en base (ia_reserver), appel au fournisseur avec délai et nouvelles tentatives bornées, puis
// ia_terminer qui garde le résultat ou rend les crédits. La dépense fournisseur est comptée même en cas d'échec.
import { ErreurFournisseur, type Fournisseur, type Message } from './fournisseur.ts';
import { valider, SortieInvalide } from './valider.ts';

export type Base = {
  reserver(user: string, travail: string, type: string, caracteres: number, cle: string | null): Promise<Record<string, unknown>>;
  terminer(travail: string, etat: string, resultat: unknown, depense: number, erreur: string | null, tentatives: number): Promise<unknown>;
};
export type Outils = { utilisateur(jeton: string): Promise<string | null>; base: Base; fournisseur: Fournisseur; delaiMs?: number; pauseMs?: number };

const TYPES = new Set(['cartes', 'resume', 'expliquer', 'quiz', 'zvi']);
const TAILLE_MAX = 4 * 1024 * 1024 + 24_000;
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

  if (Number(req.headers.get('content-length')) > TAILLE_MAX) return reponse(413, { ok: false, raison: 'entree' });
  let corps: Record<string, unknown>;
  try {
    const brut = await req.text();
    if (brut.length > TAILLE_MAX) return reponse(413, { ok: false, raison: 'entree' });
    corps = JSON.parse(brut);
  } catch { return reponse(400, { ok: false, raison: 'entree' }); }
  if (!corps || typeof corps !== 'object') return reponse(400, { ok: false, raison: 'entree' });
  // Le navigateur n'envoie ni prix, ni solde, ni utilisateur : seulement le travail demandé. Le reste est ignoré.
  const { travail, type, texte, consigne, cle, image, historique } = corps;
  const zvi = type === 'zvi';
  if (typeof travail !== 'string' || !UUID.test(travail) || typeof type !== 'string' || !TYPES.has(type) || typeof texte !== 'string' || !texte.trim()
    || (consigne != null && (typeof consigne !== 'string' || consigne.length > 500)) || (cle != null && (typeof cle !== 'string' || cle.length > 200))) return reponse(400, { ok: false, raison: 'entree' });
  if (zvi && o.fournisseur.nom === 'simule') return reponse(503, { ok: false, raison: 'ia_desactivee' });
  if (zvi && (texte.length > 4000 || (image != null && (typeof image !== 'string' || image.length > 4 * 1024 * 1024 + 30
    || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)))
    || (historique != null && (!Array.isArray(historique) || historique.length > 6 || !historique.every(m =>
      m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.length <= 1500))))) {
    return reponse(400, { ok: false, raison: 'entree' });
  }
  const messages = zvi && Array.isArray(historique)
    ? (historique as Message[]).map(({ role, content }) => ({ role, content }))
    : undefined;
  const photo = zvi && typeof image === 'string' ? image : undefined;

  const reserve = await o.base.reserver(user, travail, type, texte.length, (cle as string | undefined) ?? null);
  if (!reserve.ok || reserve.deja) return reponse(reserve.ok ? 200 : 409, reserve);

  let depense = 0, essai = 0, derniere = 'echec';
  const fal = o.fournisseur.nom === 'fal';
  while (essai < TENTATIVES) {
    essai++;
    const signal = AbortSignal.timeout(o.delaiMs ?? 30_000);
    try {
      const course = o.fournisseur.generer({ type, texte, consigne: consigne as string | undefined, historique: messages, image: photo }, signal);
      // Le délai coupe l'attente même si le fournisseur n'écoute pas le signal.
      const r = await Promise.race([course, new Promise<never>((_, ko) => signal.addEventListener('abort', () => {
        // fal peut déjà avoir facturé la requête : conserver l'estimation et éviter un deuxième envoi.
        ko(new ErreurFournisseur('délai dépassé', !fal, fal ? Number(reserve.estimation_centimes ?? 0) : 0));
      }))]);
      depense += r.depenseCentimes;
      // Une sortie mal formée ne sera pas meilleure au prochain essai : le travail échoue et les crédits sont rendus.
      let propre;
      try { propre = valider(type, r.sortie, texte, !!photo); } catch (e) {
        if (!(e instanceof SortieInvalide)) throw e;
        derniere = `sortie invalide : ${e.message}`;
        break;
      }
      await o.base.terminer(travail, 'reussi', propre, depense, null, essai);
      return reponse(200, { ok: true, travail, credits: reserve.credits, solde: reserve.solde, resultat: propre });
    } catch (e) {
      // Une erreur imprévue reste dans les journaux du serveur : la personne ne voit qu'un code neutre.
      if (!(e instanceof ErreurFournisseur)) console.error(e);
      const err = e instanceof ErreurFournisseur ? e : new ErreurFournisseur('interne', false);
      depense += err.depenseCentimes;
      derniere = err.message;
      if (!err.reessayable) break;
      if (essai < TENTATIVES) await new Promise(ok => setTimeout(ok, (o.pauseMs ?? 800) * essai));
    }
  }
  await o.base.terminer(travail, 'echoue', null, depense, derniere, essai);
  return reponse(502, { ok: false, raison: 'fournisseur', travail, rembourse: true });
}
