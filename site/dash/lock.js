// Écran de confidentialité : un code à 6 chiffres (saisi avec CodeSlots, code-slots.js) qui cache le dashboard sur CET appareil.
// Ce que c'est : un cache contre un regard ou un geste par-dessus l'épaule. Ce que ce n'est pas : une protection du compte.
// Les données restent accessibles à qui contrôle le navigateur (outils de développement, autre onglet) : elles ne sont ni
// chiffrées ni bloquées côté serveur. La connexion Supabase et la sécurité par ligne restent la vraie protection.
// Stockage (localStorage, par compte) : jamais le code, seulement un sel et une empreinte PBKDF2-SHA-256 (210 000 tours),
// plus le compteur d'essais. Un code à 6 chiffres reste devinable par qui copie cette empreinte : d'où le mot « cache ».
// Récupération : « Code oublié » déconnecte ; la reconnexion (Google ou code email) retire le verrou de l'appareil. Aucun widget
// ni contenu n'est touché.
(() => {
  const LEN = 6, ITER = 210000, FREE_TRIES = 5, BASE_WAIT = 30000, MAX_WAIT = 15 * 60000;
  const AUTO = [[0, 'Jamais'], [5, 'Après 5 min sans activité'], [15, 'Après 15 min sans activité'], [30, 'Après 30 min sans activité']];
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const node = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls ?? '', textContent: text ?? '' });
  const btn = (cls, text, onclick) => Object.assign(node('button', cls, text), { type: 'button', onclick });
  async function derive(code, salt) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
    return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256));
  }
  // Un code trop évident ne cache rien : mêmes chiffres, suite, ou les classiques.
  function weak(code) {
    if (/^(\d)\1+$/.test(code)) return true;
    const d = [...code].map(Number);
    const step = d[1] - d[0];
    if (Math.abs(step) === 1 && d.every((x, i) => i === 0 || x - d[i - 1] === step)) return true;
    return ['121212', '112233', '123123', '696969', '159753'].includes(code);
  }

  window.renzviLock = function (ctx) {
    // ctx : userId, signOut(avantDeQuitter) → false si l'enregistrement a échoué, closeAll(), say(texte)
    const KEY = `renzvi:verrou:${ctx.userId}`;
    const read = () => { try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); return r?.v === 1 && r.salt && r.hash ? r : null; } catch { return null; } };
    const write = r => { try { if (r) localStorage.setItem(KEY, JSON.stringify(r)); else localStorage.removeItem(KEY); return true; } catch { return false; } };
    let rec = read(), locked = false, back = null, lastActive = Date.now(), hiddenAt = 0, waitTimer = 0, onChangeUi = () => {};

    async function verify(code) {
      rec = read();
      if (!rec) return true;
      return (await derive(code, unb64(rec.salt))) === rec.hash;
    }
    const waitLeft = () => Math.max(0, (read()?.until ?? 0) - Date.now());

    // ---------- L'écran verrouillé ----------
    const veil = node('div', 'lock-screen');
    veil.setAttribute('role', 'dialog');
    veil.setAttribute('aria-modal', 'true');
    veil.setAttribute('aria-labelledby', 'lock-title');
    veil.hidden = true;
    const card = node('div', 'lock-card');
    const mark = node('div', 'lock-mark');
    mark.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="9" height="9" rx="3" fill="currentColor"/><rect x="13" y="2" width="9" height="9" rx="3" fill="currentColor" opacity=".3"/><rect x="2" y="13" width="9" height="9" rx="3" fill="currentColor" opacity=".3"/><rect x="13" y="13" width="9" height="9" rx="3" fill="currentColor" opacity=".3"/></svg>';
    const h = node('h1', 'lock-title', 'Écran verrouillé');
    h.id = 'lock-title';
    const sub = node('p', 'lock-sub', 'Entre ton code à 6 chiffres.');
    const msg = node('p', 'lock-msg');
    msg.id = 'lock-msg';
    msg.setAttribute('role', 'alert');
    const slots = window.CodeSlots({ length: LEN, label: 'Code de l’écran', describedBy: 'lock-msg', onComplete: code => tryUnlock(code) });
    const forgot = btn('link lock-forgot', 'Code oublié ?', () => askForgot());
    const forgotBox = node('div', 'lock-forgot-box');
    forgotBox.hidden = true;
    card.append(mark, h, sub, slots.el, msg, forgot, forgotBox);
    veil.append(card);
    document.body.append(veil);

    function askForgot() {
      forgotBox.replaceChildren(
        node('p', '', 'Tu vas être déconnecté. Reconnecte-toi avec Google ou ton code email : le verrou de cet appareil sera retiré. Tes widgets et leur contenu restent sur ton compte.'),
        (() => {
          const a = node('div', 'actions');
          const out = btn('primary', 'Me déconnecter', async () => {
            out.disabled = true;
            // D'abord enregistrer : une modification en attente ne doit pas se perdre. Le verrou n'est retiré qu'ensuite.
            const ok = await ctx.signOut(() => { write(null); rec = null; });
            if (!ok) { out.disabled = false; msg.textContent = 'Tes derniers changements ne sont pas encore enregistrés. Vérifie ta connexion et réessaie.'; }
          });
          a.append(btn('ghost', 'Annuler', () => { forgotBox.hidden = true; forgot.hidden = false; slots.focus(); }), out);
          return a;
        })(),
      );
      forgot.hidden = true;
      forgotBox.hidden = false;
      forgotBox.querySelector('.primary').focus();
    }
    function showWait() {
      clearTimeout(waitTimer);
      const left = waitLeft();
      slots.disable(left > 0);
      if (left > 0) {
        msg.textContent = `Trop d’essais. Réessaie dans ${left >= 60000 ? `${Math.ceil(left / 60000)} min` : `${Math.ceil(left / 1000)} s`}.`;
        waitTimer = setTimeout(showWait, 1000);
      } else if (/^Trop/.test(msg.textContent)) { msg.textContent = ''; slots.focus(); }
    }
    let checking = false;
    async function tryUnlock(code) {
      if (waitLeft() > 0 || checking) return;
      // La vérification prend un instant (PBKDF2) : pas de deuxième essai pendant ce temps.
      checking = true;
      slots.disable(true);
      const ok = await verify(code);
      checking = false;
      slots.disable(false);
      if (ok) {
        const r = read();
        if (r) write({ ...r, fails: 0, until: 0 });
        slots.setStatus('success');
        msg.textContent = '';
        setTimeout(unlock, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420);
        return;
      }
      const r = read();
      const fails = (r?.fails ?? 0) + 1;
      const until = fails >= FREE_TRIES ? Date.now() + Math.min(MAX_WAIT, BASE_WAIT * 2 ** (fails - FREE_TRIES)) : 0;
      if (r) write({ ...r, fails, until });
      slots.setStatus('error');
      msg.textContent = fails >= FREE_TRIES ? '' : `Code incorrect. ${FREE_TRIES - fails > 1 ? `Encore ${FREE_TRIES - fails} essais` : 'Encore 1 essai'} avant une attente.`;
      setTimeout(() => { slots.setStatus('idle'); showWait(); if (waitLeft() === 0) slots.focus(); }, 420);
    }
    function lock() {
      rec = read();
      if (!rec || locked) return;
      locked = true;
      back = document.activeElement;
      ctx.closeAll();
      document.body.classList.add('locked');
      // Tout le reste devient inerte : ni clic, ni clavier, ni lecteur d'écran. Le minuteur et les sons continuent.
      for (const n of document.body.children) if (n !== veil && n.tagName !== 'SCRIPT') { n.dataset.lockInert = n.inert ? 'keep' : ''; n.inert = true; }
      slots.clear();
      msg.textContent = '';
      forgotBox.hidden = true;
      forgot.hidden = false;
      veil.hidden = false;
      showWait();
      if (waitLeft() === 0) slots.focus();
      ctx.say('Écran verrouillé');
    }
    function unlock() {
      locked = false;
      veil.hidden = true;
      document.body.classList.remove('locked');
      for (const n of document.body.children) if ('lockInert' in n.dataset) { n.inert = n.dataset.lockInert === 'keep'; delete n.dataset.lockInert; }
      lastActive = Date.now();
      slots.clear();
      if (back?.isConnected && back !== document.body) back.focus();
      ctx.say('Écran déverrouillé');
    }

    // ---------- Verrouillage automatique ----------
    for (const t of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(t, () => { if (!locked) lastActive = Date.now(); }, { passive: true, capture: true });
    const autoMs = () => (read()?.auto ?? 0) * 60000;
    setInterval(() => { if (!locked && autoMs() && Date.now() - lastActive >= autoMs()) lock(); }, 15000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (!locked && autoMs() && hiddenAt && Date.now() - hiddenAt >= autoMs()) lock();
    });

    // ---------- Réglages ----------
    const dlg = node('dialog', 'glass lock-setup');
    dlg.setAttribute('aria-labelledby', 'lock-setup-title');
    document.body.append(dlg);
    // steps : 'verify' (code actuel), 'new', 'confirm'. then : 'set' | 'off'
    function flow(then) {
      const back2 = document.activeElement;
      const steps = [...(read() ? ['verify'] : []), ...(then === 'set' ? ['new', 'confirm'] : [])];
      let i = 0, first = '';
      const title = node('h2', '', then === 'off' ? 'Désactiver le verrou' : read() ? 'Changer le code' : 'Choisir un code');
      title.id = 'lock-setup-title';
      const lead = node('p', 'desc');
      const err = node('p', 'lock-msg');
      err.id = 'lock-setup-msg';
      err.setAttribute('role', 'alert');
      const slot = node('div', 'lock-setup-slot');
      const actions = node('div', 'actions');
      actions.append(btn('ghost', 'Annuler', () => dlg.close()));
      dlg.replaceChildren(title, lead, slot, err, actions);
      let cs = null;
      async function done(code) {
        const step = steps[i];
        if (step === 'verify') {
          if (waitLeft() > 0) { err.textContent = 'Trop d’essais. Attends un peu avant de réessayer.'; cs.setStatus('error'); return; }
          if (!(await verify(code))) {
            const r = read(), fails = (r?.fails ?? 0) + 1;
            if (r) write({ ...r, fails, until: fails >= FREE_TRIES ? Date.now() + Math.min(MAX_WAIT, BASE_WAIT * 2 ** (fails - FREE_TRIES)) : 0 });
            err.textContent = 'Code incorrect.';
            cs.setStatus('error');
            setTimeout(() => cs.setStatus('idle'), 420);
            return;
          }
          const r = read();
          if (r) write({ ...r, fails: 0, until: 0 });
          if (then === 'off') { write(null); rec = null; dlg.close(); onChangeUi(); ctx.say('Verrou désactivé sur cet appareil'); return; }
        } else if (step === 'new') {
          if (weak(code)) { err.textContent = 'Ce code est trop facile à deviner. Évite les suites et les chiffres répétés.'; cs.setStatus('error'); setTimeout(() => cs.setStatus('idle'), 420); return; }
          first = code;
        } else if (step === 'confirm') {
          if (code !== first) { i = steps.indexOf('new'); first = ''; show(); err.textContent = 'Les deux codes ne sont pas identiques. Recommence.'; return; }
          const salt = crypto.getRandomValues(new Uint8Array(16));
          const hash = await derive(code, salt);
          if (!write({ v: 1, salt: b64(salt), hash, iter: ITER, auto: read()?.auto ?? 0, fails: 0, until: 0 })) { err.textContent = 'Ce navigateur refuse d’enregistrer le verrou (navigation privée ?).'; return; }
          rec = read();
          cs.setStatus('success');
          setTimeout(() => { dlg.close(); onChangeUi(); ctx.say('Verrou activé sur cet appareil'); }, 420);
          return;
        }
        i++;
        show();
      }
      function show() {
        cs?.destroy();
        const step = steps[i];
        lead.textContent = step === 'verify' ? 'Entre ton code actuel.' : step === 'new' ? 'Choisis 6 chiffres. Évite ta date de naissance et les suites.' : 'Entre-le une seconde fois pour confirmer.';
        err.textContent = '';
        cs = window.CodeSlots({ length: LEN, label: step === 'verify' ? 'Code actuel' : step === 'new' ? 'Nouveau code' : 'Confirmer le code', describedBy: 'lock-setup-msg', onComplete: done });
        slot.replaceChildren(cs.el);
        cs.focus();
      }
      dlg.onclose = () => { cs?.destroy(); back2?.isConnected && back2.focus(); };
      dlg.showModal();
      show();
    }

    function settingsSection() {
      const sec = node('section', 'set-sec lock-set');
      sec.setAttribute('aria-labelledby', 'set-lock');
      const h3 = node('h3', '', 'Verrouillage de l’écran');
      h3.id = 'set-lock';
      const state = node('p', 'desc');
      const tools = node('div', 'lock-tools');
      const autoRow = node('div', 'set-row');
      const autoLabel = node('label', '', 'Verrouiller seul');
      autoLabel.htmlFor = 'lock-auto';
      const auto = node('select');
      auto.id = 'lock-auto';
      for (const [v, t] of AUTO) auto.append(Object.assign(node('option', '', t), { value: String(v) }));
      auto.onchange = () => { const r = read(); if (r) { write({ ...r, auto: Number(auto.value) }); lastActive = Date.now(); } };
      autoRow.append(autoLabel, auto);
      const help = node('p', 'desc lock-help', 'Sur cet appareil seulement. Un cache contre les regards, pas une protection du compte : tes données ne sont pas chiffrées, et quelqu’un qui contrôle ce navigateur peut le contourner. Le minuteur et les sons continuent derrière. Code oublié : il suffit de te reconnecter.');
      function draw() {
        const on = !!read();
        state.textContent = on ? 'Activé sur cet appareil.' : 'Désactivé.';
        tools.replaceChildren(...(on
          ? [btn('primary', 'Verrouiller maintenant', () => lock()), btn('ghost', 'Changer le code', () => flow('set')), btn('ghost', 'Désactiver', () => flow('off'))]
          : [btn('primary', 'Choisir un code', () => flow('set'))]));
        autoRow.hidden = !on;
        auto.value = String(read()?.auto ?? 0);
      }
      onChangeUi = draw;
      draw();
      sec.append(h3, state, tools, autoRow, help);
      return sec;
    }

    if (rec) lock();
    return { lock, isLocked: () => locked, enabled: () => !!read(), settingsSection };
  };
})();
