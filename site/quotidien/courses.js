// Liste de courses. Données dans widget_state, ligne « courses » : { items, listes, masquer, cat }.
// Un article : { id, n (nom), q (quantité), u (unité), c (rayon), ok (acheté), src (origine : recette) }.
// Rien n'est fusionné tout seul : « 200 g de farine » et « 1 kg de farine » restent deux lignes, « lait » et « lait d'avoine » aussi.
// Gratuit : la liste en cours, quantités, rayons, cocher. Pro : listes enregistrées (modèles) et repartir d'une liste.
// Les recettes (« Qu'est-ce qu'on mange ? ») ajoutent leurs ingrédients manquants par coursesAjouter, ci-dessous.

const COURSES_RAYONS = ['Fruits et légumes', 'Frais', 'Boucherie et poisson', 'Boulangerie', 'Épicerie', 'Boissons', 'Surgelés', 'Hygiène et beauté', 'Maison', 'Autre'];
const COURSES_MAX = 200, COURSES_MAX_LISTES = 12;

function coursesNettoyer(d) {
  const ok = it => it && typeof it.id === 'string' && typeof it.n === 'string' && it.n.trim();
  const art = it => ({
    id: it.id, n: it.n.trim().slice(0, 60), c: COURSES_RAYONS.includes(it.c) ? it.c : 'Autre', ok: !!it.ok,
    ...(Number.isFinite(it.q) && it.q > 0 && it.q <= 9999 ? { q: Math.round(it.q * 100) / 100, u: Q.UNITES.includes(it.u) ? it.u : '' } : {}),
    ...(typeof it.src === 'string' ? { src: it.src.slice(0, 120) } : {}),
  });
  return {
    items: (Array.isArray(d?.items) ? d.items : []).filter(ok).map(art).slice(0, COURSES_MAX),
    listes: (Array.isArray(d?.listes) ? d.listes : []).filter(l => l && typeof l.id === 'string' && typeof l.nom === 'string')
      .map(l => ({ id: l.id, nom: l.nom.slice(0, 40), items: (Array.isArray(l.items) ? l.items : []).filter(it => it && typeof it.n === 'string').map(it => { const { id, ok: _, src, ...r } = art({ ...it, id: 'x' }); return r; }).slice(0, 100) }))
      .slice(0, COURSES_MAX_LISTES),
    masquer: !!d?.masquer,
    cat: COURSES_RAYONS.includes(d?.cat) ? d.cat : 'Autre',
  };
}

// Ajout depuis un autre widget (recettes) : les lignes déjà présentes et pas encore achetées avec la même origine ne sont pas
// rajoutées (un double clic ne double rien). Renvoie le nombre d'articles ajoutés, ou -1 si la liste est pleine.
function coursesAjouter(peer, savePeer, lignes) {
  const etat = coursesNettoyer(peer('courses'));
  const deja = new Set(etat.items.filter(it => !it.ok && it.src).map(it => it.src));
  const neufs = lignes.filter(l => !deja.has(l.src)).map(l => ({ ...Q.article(l.texte), id: crypto.randomUUID(), c: 'Autre', ok: false, src: l.src }));
  if (!neufs.length) return 0;
  if (etat.items.length + neufs.length > COURSES_MAX) return -1;
  savePeer('courses', { ...etat, items: [...etat.items, ...neufs] });
  return neufs.length;
}

function coursesWidget({ body, meta, data, save, peer, apercu }) {
  let etat = coursesNettoyer(data);
  const persist = () => save(etat);

  const form = el('form', 'add q-add-form');
  const champ = qInput('text', { placeholder: 'Ex. : 2 kg pommes', maxLength: 70, enterKeyHint: 'done' });
  champ.ariaLabel = 'Article à ajouter, avec sa quantité si tu veux';
  const rayon = qSelect(COURSES_RAYONS.map(r => [r, r]), etat.cat, { className: 'q-rayon' });
  rayon.ariaLabel = 'Rayon';
  form.append(champ, rayon, Object.assign(el('button', 'ghost', 'Ajouter'), { type: 'submit' }));
  const note = el('p', 'note');
  note.hidden = true;
  note.setAttribute('role', 'status');
  const vide = el('div', 'empty q-empty');
  vide.append(el('p', '', 'Ta liste est vide.'));
  const groupes = el('div', 'q-rayons');
  const pied = el('div', 'q-pied');
  const masquer = button('q-link', '', () => { etat.masquer = !etat.masquer; persist(); dessiner(); });
  const vider = button('q-link q-danger-text', '', async () => {
    const n = etat.items.filter(it => it.ok).length;
    if (!n || !await qConfirmer('Vider les achetés', `Retirer ${n > 1 ? `les ${n} articles achetés` : 'l’article acheté'} de la liste ? Les articles à acheter restent.`, 'Retirer')) return;
    etat.items = etat.items.filter(it => !it.ok);
    persist();
    dessiner();
    champ.focus();
  });
  const listesBtn = button('ghost q-small-btn', '', () => mesListes());
  pied.append(masquer, vider, listesBtn);
  // Agrandi : les listes enregistrées à côté.
  const cote = el('section', 'q-big q-cote');
  body.append(form, note, vide, groupes, pied, cote);

  form.onsubmit = e => {
    e.preventDefault();
    if (apercu) return;
    const a = Q.article(champ.value);
    if (!a.n) return champ.focus();
    if (etat.items.length >= COURSES_MAX) { note.textContent = `Ta liste est pleine (${COURSES_MAX} articles). Vide les achetés pour continuer.`; note.hidden = false; return; }
    etat.items = [...etat.items, { ...a, id: crypto.randomUUID(), c: rayon.value, ok: false }];
    etat.cat = rayon.value;
    champ.value = '';
    note.hidden = true;
    persist();
    dessiner();
    champ.focus();
  };

  function ligne(it) {
    const li = el('li', `q-item q-check-row${it.ok ? ' done' : ''}`);
    const lab = el('label');
    const c = qInput('checkbox', { checked: it.ok, disabled: !!apercu });
    c.onchange = () => {
      it.ok = c.checked;
      persist();
      // Pas de redessin immédiat si on garde les achetés à l'écran : la case garde le focus clavier.
      if (etat.masquer) { const next = li.nextElementSibling ?? li.previousElementSibling; dessiner(); next?.querySelector?.('input')?.focus(); }
      else { li.classList.toggle('done', it.ok); compter(); }
    };
    const quoi = el('span', 'q-what');
    quoi.append(el('span', 'q-titre', it.n));
    if (it.q) quoi.append(el('span', 'q-qte', Q.quantite(it)));
    lab.append(c, quoi);
    const edit = button('q-icon-btn', '', () => modifier(it));
    edit.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 2.5l3 3-8 8H2.5v-3z"/></svg>';
    edit.ariaLabel = `Modifier ${it.n}`;
    li.append(lab, edit);
    return li;
  }
  function compter() {
    const reste = etat.items.filter(it => !it.ok).length, achetes = etat.items.length - reste;
    meta.textContent = etat.items.length ? (reste ? `${reste} à acheter` : 'Tout est acheté') : '';
    masquer.textContent = etat.masquer ? `Afficher les achetés (${achetes})` : 'Masquer les achetés';
    masquer.hidden = !achetes;
    vider.textContent = 'Vider les achetés';
    vider.hidden = !achetes;
    listesBtn.replaceChildren('Mes listes');
    if (!qPro()) listesBtn.append(' ', qProChip());
  }
  function dessiner() {
    const montres = etat.items.filter(it => !etat.masquer || !it.ok);
    vide.hidden = etat.items.length > 0;
    if (etat.items.length && !montres.length) { vide.hidden = false; vide.replaceChildren(el('p', '', 'Tout est acheté.')); }
    else vide.replaceChildren(el('p', '', 'Ta liste est vide.'));
    groupes.replaceChildren(...COURSES_RAYONS.map(r => {
      const ici = montres.filter(it => it.c === r).sort((a, b) => a.ok - b.ok);
      if (!ici.length) return null;
      const sec = el('section', 'q-rayon-sec');
      const h = el('h3', 'q-h3', r);
      const ul = el('ul', 'q-list');
      ul.append(...ici.map(ligne));
      sec.append(h, ul);
      return sec;
    }).filter(Boolean));
    compter();
    dessinerCote();
  }

  function modifier(it) {
    if (apercu) return;
    const f = el('form', 'q-form');
    const n = qInput('text', { value: it.n, maxLength: 60, required: true });
    const q = qInput('text', { value: it.q ? String(it.q).replace('.', ',') : '', inputMode: 'decimal', placeholder: 'Facultatif' });
    const u = qSelect(Q.UNITES.map(x => [x, x || 'Aucune']), it.u ?? '');
    const c = qSelect(COURSES_RAYONS.map(r => [r, r]), it.c);
    const err = el('p', 'note');
    err.hidden = true;
    const ligneQ = el('div', 'q-row2');
    ligneQ.append(qChamp('Quantité', q), qChamp('Unité', u));
    const actions = el('div', 'q-actions');
    actions.append(button('ghost q-left q-danger-text', 'Supprimer', () => {
      etat.items = etat.items.filter(x => x !== it); persist(); dessiner(); d.close();
    }), button('ghost', 'Annuler', () => d.close()), Object.assign(el('button', 'primary', 'Enregistrer'), { type: 'submit' }));
    f.append(qChamp('Article', n), ligneQ, qChamp('Rayon', c), err, actions);
    f.onsubmit = e => {
      e.preventDefault();
      const nom = n.value.trim();
      const qte = q.value.trim() ? Number(q.value.trim().replace(',', '.')) : null;
      err.hidden = false;
      if (!nom) return void (err.textContent = 'Donne un nom à l’article.');
      if (qte !== null && !(qte > 0 && qte <= 9999 && /^\d{1,4}([.,]\d{1,2})?$/.test(q.value.trim()))) return void (err.textContent = 'Quantité : un nombre entre 0,01 et 9 999, deux décimales au plus.');
      Object.assign(it, { n: nom.slice(0, 60), c: c.value });
      if (qte) { it.q = qte; it.u = u.value; } else { delete it.q; delete it.u; }
      persist(); dessiner(); d.close();
    };
    const d = qFiche('Modifier l’article', f);
  }

  // ---------- Pro : listes enregistrées ----------
  const copie = items => items.map(({ n, q, u, c }) => ({ n, c, ...(q ? { q, u } : {}) }));
  function garderListe(nom) {
    if (etat.listes.length >= COURSES_MAX_LISTES) return `${COURSES_MAX_LISTES} listes au plus. Supprimes-en une d’abord.`;
    if (!etat.items.length) return 'Ta liste est vide : ajoute des articles avant de la garder.';
    etat.listes = [...etat.listes, { id: crypto.randomUUID(), nom, items: copie(etat.items).slice(0, 100) }];
    persist();
    dessiner();
    return null;
  }
  async function utiliser(l, depuis) {
    if (qVerrou('Les listes enregistrées')) return;
    const reste = etat.items.filter(it => !it.ok).length;
    let mode = 'ajouter';
    if (etat.items.length) {
      mode = await new Promise(resolve => {
        let r = null;
        const box = el('div', 'q-form');
        box.append(el('p', 'q-texte', `Ta liste actuelle a ${reste} article${reste > 1 ? 's' : ''} à acheter${etat.items.length > reste ? ` et ${etat.items.length - reste} acheté${etat.items.length - reste > 1 ? 's' : ''}` : ''}.`));
        const actions = el('div', 'q-actions q-actions-col');
        actions.append(
          button('primary', `Ajouter les ${l.items.length} articles de « ${l.nom} »`, () => { r = 'ajouter'; dd.close(); }),
          button('ghost q-danger-text', 'Remplacer ma liste actuelle', () => { r = 'remplacer'; dd.close(); }),
          button('ghost', 'Annuler', () => dd.close()));
        box.append(actions);
        const dd = qFiche(`Partir de « ${l.nom} »`, box, { onClose: () => resolve(r) });
      });
      if (!mode) return;
      if (mode === 'remplacer' && !await qConfirmer('Remplacer la liste', `Les ${etat.items.length} articles de ta liste actuelle seront retirés. « ${l.nom} » reste enregistrée.`, 'Remplacer')) return;
    }
    const neufs = l.items.map(it => ({ ...it, id: crypto.randomUUID(), ok: false }));
    const items = mode === 'remplacer' ? neufs : [...etat.items, ...neufs];
    if (items.length > COURSES_MAX) { note.textContent = `Ça ferait plus de ${COURSES_MAX} articles. Vide les achetés d’abord.`; note.hidden = false; return; }
    etat.items = items;
    persist();
    dessiner();
    depuis?.close?.();
  }
  async function retirer(l) {
    if (!await qConfirmer('Supprimer la liste enregistrée', `« ${l.nom} » ne sera plus proposée. Ta liste en cours ne change pas.`)) return false;
    etat.listes = etat.listes.filter(x => x !== l);
    persist();
    dessiner();
    return true;
  }
  function blocListes(dialog) {
    const box = el('div', 'q-listes');
    const ul = el('ul', 'q-list');
    for (const l of etat.listes) {
      const li = el('li', 'q-item q-liste');
      const quoi = el('span', 'q-what');
      quoi.append(el('span', 'q-titre', l.nom), el('span', 'q-sous', `${l.items.length} article${l.items.length > 1 ? 's' : ''}`));
      const go = button('ghost q-small-btn', 'Utiliser', () => utiliser(l, dialog));
      go.ariaLabel = `Utiliser la liste ${l.nom}`;
      const x = button('x', '×', async () => { if (await retirer(l) && dialog) { dialog.close(); mesListes(); } });
      x.ariaLabel = `Supprimer la liste ${l.nom}`;
      li.append(quoi, go, x);
      ul.append(li);
    }
    if (!etat.listes.length) box.append(el('p', 'q-aide', 'Garde une liste que tu refais souvent (la semaine, l’apéro, le ménage) pour la reprendre en un clic.'));
    const f = el('form', 'add');
    const nom = qInput('text', { placeholder: 'Nom (ex. : La semaine)', maxLength: 40 });
    nom.ariaLabel = 'Nom de la liste à garder';
    const msg = el('p', 'note');
    msg.hidden = true;
    msg.setAttribute('role', 'status');
    f.append(nom, Object.assign(el('button', 'ghost', 'Garder ma liste'), { type: 'submit' }));
    f.onsubmit = e => {
      e.preventDefault();
      if (apercu || qVerrou('Les listes enregistrées')) return;
      if (!nom.value.trim()) return nom.focus();
      const err = garderListe(nom.value.trim());
      msg.hidden = false;
      msg.textContent = err ?? `« ${nom.value.trim()} » est enregistrée.`;
      msg.classList.toggle('ok', !err);
      if (!err) { nom.value = ''; if (dialog) { dialog.close(); mesListes(); } }
    };
    box.append(ul, f, msg);
    return box;
  }
  function mesListes() {
    if (apercu) return;
    if (!qPro() && !etat.listes.length) { qVerrou('Les listes enregistrées'); return; }
    const box = el('div', 'q-form');
    const d = qFiche('Mes listes', box);
    box.append(blocListes(d));
    if (!qPro()) box.prepend(el('p', 'q-aide', 'Tes listes restent enregistrées. Les réutiliser fait partie de Pro.'));
  }
  function dessinerCote() {
    const h = el('h3', 'q-h3', 'Mes listes');
    if (!qPro()) h.append(' ', qProChip());
    cote.replaceChildren(h, blocListes(null));
  }

  dessiner();
  if (apercu) return null;
  const stop = qEcouter('courses', 'courses', () => { etat = coursesNettoyer(peer('courses')); dessiner(); });
  const stopPlan = qEcouterPlan(dessiner);
  return () => { stop(); stopPlan(); };
}
