// Study S4/S5 côté navigateur : demander une génération à la fonction serveur « ia » et l'afficher dans le Cahier.
// Le navigateur n'envoie que le travail demandé (type, texte du chapitre ou du passage, identifiant). Le prix, le solde
// et la personne débitée sont décidés par le serveur ; le coût affiché ici n'est qu'une estimation de la même grille.
// Les résultats sont gardés (table ia_travaux) : les revoir ne coûte rien, régénérer est un choix explicite.
// Utilise el, button, plural, SUPABASE_URL, SUPABASE_KEY (dashboard.html) et cartesChanged, CARTES (cartes.js).
const IA_MESSAGES = {
  session: 'Ta session a expiré : recharge la page et reconnecte-toi.',
  trop_de_travaux: 'Une génération est déjà en cours : attends qu’elle finisse.',
  trop_de_demandes: 'Beaucoup de demandes cette heure-ci : réessaie un peu plus tard.',
  budget_global: "L'IA est en pause pour aujourd'hui. Tes cours et tes cartes restent disponibles.",
  ia_desactivee: "L'IA est en pause pour le moment. Tes cours et tes cartes restent disponibles.",
  fournisseur: "La génération n'a pas abouti. Tes crédits t'ont été rendus.",
  deja_en_cours: 'Cette génération est déjà en cours.',
  reseau: "La demande n'est pas partie. Vérifie ta connexion : rien n'a été débité.",
};
function iaMessage(r) {
  if (r.raison === 'solde_insuffisant') return `Il te faut ${plural(r.credits, 'crédit')}, tu en as ${r.solde}.`;
  if (r.raison === 'texte_trop_long') return `Ce passage est trop long pour l'IA (${r.max} caractères au plus). Coupe-le avec « Modifier les chapitres ».`;
  return IA_MESSAGES[r.raison] ?? "La demande n'a pas abouti.";
}

let iaGrille = null;
// La grille de prix (lecture seule) et le solde de la personne, pour annoncer le coût avant de lancer.
async function iaInfos(sb) {
  if (!iaGrille) {
    const { data } = await sb.from('ia_prix').select('type,caracteres_par_credit,credits_min,credits_max,caracteres_max');
    if (data?.length) iaGrille = Object.fromEntries(data.map(p => [p.type, p]));
  }
  const { data: w } = await sb.from('ia_portefeuilles').select('solde').maybeSingle();
  return { grille: iaGrille, solde: w?.solde ?? null };
}
function iaCout(grille, type, caracteres) {
  const p = grille?.[type];
  if (!p) return null;
  return { credits: Math.min(p.credits_max, Math.max(p.credits_min, Math.ceil(caracteres / p.caracteres_par_credit))), trop: caracteres > p.caracteres_max, max: p.caracteres_max };
}
async function iaPrecedent(sb, type, cle) {
  const { data } = await sb.from('ia_travaux').select('id,resultat,created_at').eq('type', type).eq('cle', cle).eq('etat', 'reussi').order('created_at', { ascending: false }).limit(1);
  return data?.[0] ?? null;
}
async function iaDemander(sb, corps) {
  const { data } = await sb.auth.getSession();
  const jeton = data?.session?.access_token;
  if (!jeton) return { ok: false, raison: 'session', message: IA_MESSAGES.session };
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/ia`, { method: 'POST', headers: { authorization: `Bearer ${jeton}`, apikey: SUPABASE_KEY, 'content-type': 'application/json' }, body: JSON.stringify(corps) });
    const j = await r.json().catch(() => ({ ok: false, raison: r.status === 401 ? 'session' : 'fournisseur' }));
    return j.ok ? j : { ...j, message: iaMessage(j) };
  } catch { return { ok: false, raison: 'reseau', message: IA_MESSAGES.reseau }; }
}

// Le texte d'un chapitre envoyé à l'IA, et de quoi retrouver la page et la position d'une citation.
function iaChapitre(pages, parts) {
  let texte = '';
  const morceaux = [];
  for (const s of parts) {
    if (texte) texte += '\n';
    morceaux.push({ at: texte.length, page: s.page, start: s.start, end: s.end });
    texte += pages[s.page].slice(s.start, s.end);
  }
  const position = debut => {
    const m = [...morceaux].reverse().find(x => x.at <= debut);
    return m ? { page: m.page, offset: Math.min(m.end, m.start + debut - m.at) } : null;
  };
  return { texte, position };
}

// Le panneau IA du Cahier. ctx : { sb, course, chapter, pages, parts, show(pos), close(), say(text, bad) }.
function iaPanneau(ctx) {
  const panel = el('div', 'cahier-edit ia-panel');
  const { texte, position } = iaChapitre(ctx.pages, ctx.parts);
  const cleDe = type => `${ctx.course.id}:${ctx.chapter.page}.${ctx.chapter.offset}:${type}`.slice(0, 200);
  const head = el('p', 'cartes-sum', `IA sur « ${ctx.chapter.title} »`);
  const infos = el('p', 'zone', 'Calcul du coût…');
  const actions = el('div', 'cahier-actions');
  const out = el('div', 'ia-out');
  const status = el('p', 'zone');
  status.setAttribute('role', 'status');
  const fermer = button('ghost', 'Fermer', ctx.close);
  panel.append(head, infos, actions, status, out, fermer);
  let occupe = false;

  async function preparer() {
    const { grille, solde } = await iaInfos(ctx.sb);
    if (!grille) { infos.textContent = "L'IA n'est pas encore disponible."; return; }
    const soldeTexte = solde == null ? 'Tu as des crédits de découverte à la première utilisation (email vérifié).' : `Ton solde : ${plural(solde, 'crédit')}.`;
    infos.textContent = `${texte.length.toLocaleString('fr-FR')} caractères. ${soldeTexte} Revoir un résultat déjà fait ne coûte rien.`;
    actions.replaceChildren();
    for (const [type, nom] of [['cartes', 'Générer des cartes'], ['resume', 'Résumer']]) {
      const cout = iaCout(grille, type, texte.length);
      const deja = await iaPrecedent(ctx.sb, type, cleDe(type));
      if (deja) actions.append(button('ghost', `${nom} : revoir le résultat (gratuit)`, () => afficher(type, deja.resultat, false)));
      const b = button(deja ? 'link' : 'primary', `${deja ? 'Régénérer' : nom} · ${plural(cout.credits, 'crédit')}`, () => lancer(type, cout));
      b.disabled = cout.trop;
      actions.append(b);
      if (cout.trop) status.textContent = `Ce chapitre est trop long pour l'IA (${cout.max.toLocaleString('fr-FR')} caractères au plus). Coupe-le avec « Modifier les chapitres ».`;
    }
  }

  async function lancer(type) {
    if (occupe) return; // un double clic ne lance qu'une génération
    occupe = true;
    actions.querySelectorAll('button').forEach(b => { b.disabled = true; });
    status.classList.remove('msg');
    status.textContent = 'Génération en cours…';
    const r = await iaDemander(ctx.sb, { travail: crypto.randomUUID(), type, texte, cle: cleDe(type) });
    occupe = false;
    if (!r.ok) { status.textContent = r.message; status.classList.add('msg'); preparer(); return; }
    status.textContent = `${plural(r.credits, 'crédit')} utilisé${r.credits > 1 ? 's' : ''}, il t'en reste ${r.solde}.`;
    afficher(type, r.resultat, true);
    preparer();
  }

  const lien = source => {
    if (!source) return el('span', 'ia-absent', 'Source non retrouvée dans le cours');
    return button('link', 'Voir dans le cours', () => { const p = position(source.debut); if (p) ctx.show({ ...p, length: source.longueur }); });
  };

  function afficher(type, res, neuf) {
    if (type === 'resume') {
      const list = el('ul', 'rows ia-list');
      list.ariaLabel = 'Résumé du chapitre';
      for (const p of res.points ?? []) { const li = el('li', 'row'); li.append(el('span', 'grow', p.texte), lien(p.source)); list.append(li); }
      return out.replaceChildren(el('p', 'cartes-sum', 'Résumé'), list);
    }
    // Cartes : aperçu, on coche celles à garder, puis on les ajoute au paquet du cours.
    const cartes = res.cartes ?? [];
    if (!cartes.length) return out.replaceChildren(el('p', 'zone', "Le cours ne contenait pas assez de matière pour des cartes."));
    const list = el('ul', 'rows ia-list');
    list.ariaLabel = 'Cartes proposées';
    const coches = cartes.map((c, i) => {
      const li = el('li', 'row');
      const label = el('label', 'grow');
      const box = Object.assign(el('input'), { type: 'checkbox', checked: !!c.source });
      const txt = el('span', '', `${c.question} — ${c.reponse}`);
      label.append(box, txt);
      li.append(label, lien(c.source));
      list.append(li);
      return { box, c, i };
    });
    const ajouter = button('primary', 'Ajouter les cartes cochées', async () => {
      const choix = coches.filter(x => x.box.checked);
      if (!choix.length) { status.textContent = 'Coche au moins une carte.'; return; }
      ajouter.disabled = true;
      const rows = choix.map(({ c }) => {
        const p = c.source ? position(c.source.debut) : null;
        return { deck: ctx.course.title.slice(0, CARTES.deck), kind: 'qa', front: c.question.slice(0, CARTES.front), back: c.reponse.slice(0, CARTES.back), holes: [], course_id: ctx.course.id, ...(p && { src_page: p.page, src_offset: p.offset, src_length: Math.min(5000, c.source.longueur) }) };
      });
      const { error } = await ctx.sb.from('study_cards').insert(rows);
      ajouter.disabled = false;
      if (error) { status.textContent = "Les cartes n'ont pas été ajoutées. Vérifie ta connexion."; status.classList.add('msg'); return; }
      cartesChanged();
      status.classList.remove('msg');
      status.textContent = `${plural(rows.length, 'carte')} ajoutée${rows.length > 1 ? 's' : ''} au paquet « ${rows[0].deck} ».`;
      ajouter.hidden = true;
    });
    out.replaceChildren(el('p', 'cartes-sum', neuf ? 'Cartes proposées : vérifie-les avant de les ajouter' : 'Cartes déjà générées'), el('p', 'zone', 'Les cartes sans source retrouvée sont décochées : vérifie-les dans ton cours.'), list, ajouter);
  }

  preparer();
  return panel;
}

// Expliquer un passage sélectionné. Le contexte envoyé : la sélection et ce qui l'entoure, 2000 caractères au plus.
function iaExplication({ sb, page, sel, close }) {
  const panel = el('div', 'cahier-edit ia-panel');
  const avant = Math.max(0, sel.offset - 700), apres = Math.min(page.length, sel.offset + sel.length + 700);
  const texte = page.slice(avant, apres).slice(0, 2000);
  const consigne = sel.text.trim().slice(0, 500);
  const status = el('p', 'zone');
  status.setAttribute('role', 'status');
  const out = el('div', 'ia-out');
  const go = button('primary', 'Expliquer · 1 crédit', async () => {
    go.disabled = true;
    status.textContent = 'Explication en cours…';
    const r = await iaDemander(sb, { travail: crypto.randomUUID(), type: 'expliquer', texte, consigne });
    go.disabled = false;
    if (!r.ok) { status.textContent = r.message; status.classList.add('msg'); return; }
    status.classList.remove('msg');
    status.textContent = `Il te reste ${plural(r.solde, 'crédit')}.`;
    const e = r.resultat;
    out.replaceChildren(
      el('p', e.dans_le_cours ? 'ia-tag' : 'ia-tag ia-absent', e.dans_le_cours ? "D'après ton cours" : 'Ton cours ne permet pas de répondre complètement'),
      el('p', 'cartes-back', e.explication),
      ...(e.exemple_exterieur ? [el('p', 'ia-tag ia-absent', 'Exemple qui ne vient pas de ton cours'), el('p', 'cartes-back', e.exemple_exterieur)] : []),
    );
    go.hidden = true;
  });
  panel.append(el('p', 'cartes-sum', 'Expliquer ce passage'), el('p', 'cartes-face ia-quote', `« ${consigne} »`), go, status, out, button('ghost', 'Fermer', close));
  return panel;
}
