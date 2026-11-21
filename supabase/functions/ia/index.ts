// Fonction serveur Supabase « ia ». Variables fournies par Supabase : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_DB_URL.
// FAL_KEY active Gemma via fal. IA_FOURNISSEUR=simule force le mode local.
import postgres from 'npm:postgres@3.4.5';
import { choisirFournisseur } from './fournisseur.ts';
import { traiter } from './logique.ts';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 3, prepare: false });
const url = Deno.env.get('SUPABASE_URL')!, cle = Deno.env.get('SUPABASE_ANON_KEY')!;

// La session est vérifiée par Supabase Auth lui-même : un jeton fabriqué ou expiré est refusé.
async function utilisateur(jeton: string) {
  const r = await fetch(`${url}/auth/v1/user`, { headers: { authorization: `Bearer ${jeton}`, apikey: cle } });
  if (!r.ok) return null;
  const u = await r.json();
  return typeof u?.id === 'string' ? u.id : null;
}

const base = {
  async reserver(user: string, travail: string, type: string, caracteres: number, cle: string | null) {
    const [r] = await sql`select public.ia_reserver(${user}::uuid, ${travail}::uuid, ${type}, ${caracteres}, ${cle}) as r`;
    return r.r;
  },
  async terminer(travail: string, etat: string, resultat: unknown, depense: number, erreur: string | null, tentatives: number) {
    const [r] = await sql`select public.ia_terminer(${travail}::uuid, ${etat}, ${resultat === null ? null : sql.json(resultat as never)}, ${depense}, ${erreur}, ${tentatives}) as r`;
    return r.r;
  },
};

const cleFal = Deno.env.get('FAL_KEY');
const fournisseur = choisirFournisseur(Deno.env.get('IA_FOURNISSEUR'), cleFal?.trim());
console.info('IA fournisseur', { fournisseur: fournisseur.nom, cleFalPresente: !!cleFal?.trim() });
Deno.serve(req => traiter(req, { utilisateur, base, fournisseur }));
