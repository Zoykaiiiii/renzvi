// Minuteur focus : un seul moteur (l'heure de fin fait foi), trois façons de régler la durée qui restent d'accord :
// les préréglages, le cadran (CometDial, comet-dial.js) et les champs minutes/secondes. Le cadran n'a pas d'horloge :
// pendant une session, il montre seulement le temps restant.
// Enregistré : { length (minutes, ancien format gardé), dur (secondes), day, minutes, log, run }.
// run = { end } pendant une session, { left } en pause, null sinon. Une session en cours survit donc au rechargement ;
// si son heure de fin est passée pendant que la page était fermée, elle est comptée une fois, au retour.
(() => {
  const MIN_DUR = 10, MAX_DUR = 180 * 60, PRESETS = [15, 25, 50];
  const two = n => String(n).padStart(2, '0');
  const label = sec => `${two(Math.floor(sec / 60))}:${two(sec % 60)}`;
  const okDur = n => Number.isInteger(n) && n >= MIN_DUR && n <= MAX_DUR;

  window.renzviMinuteur = function ({ body, meta, data, save }) {
    const pageTitle = document.title;
    let dur = okDur(data?.dur) ? data.dur : PRESETS.includes(data?.length) ? data.length * 60 : 25 * 60;
    let day = dayKey(new Date());
    let minutes = data?.day === day && Number.isFinite(data?.minutes) ? data.minutes : 0;
    let log = focusLog(data);
    // state : 'idle' (réglable), 'run' (endAt), 'pause' (left)
    let state = 'idle', endAt = 0, left = dur * 1000, ticker = null;
    const run = data?.run;
    if (run && Number.isFinite(run.end) && run.end > 0) { state = 'run'; endAt = run.end; }
    else if (run && Number.isFinite(run.left) && run.left > 0 && run.left <= dur * 1000) { state = 'pause'; left = run.left; }

    const remaining = () => (state === 'run' ? Math.max(0, endAt - Date.now()) : state === 'pause' ? left : dur * 1000);
    const runState = () => (state === 'run' ? { end: endAt } : state === 'pause' ? { left } : null);
    const persist = () => save({ length: Math.max(1, Math.round(dur / 60)), dur, day, minutes, log, run: runState() });

    const choices = el('div', 'choices');
    choices.setAttribute('role', 'group');
    choices.ariaLabel = 'Durée de la session';
    const presets = PRESETS.map(n => {
      const b = button('', `${n} min`, () => setDur(n * 60, 'preset'));
      choices.append(b);
      return [n, b];
    });

    const dial = window.CometDial({
      value: Math.round(dur / 60), min: 1, max: 180, step: 1, unit: '', label: 'Durée de la session',
      format: () => label(Math.ceil(remaining() / 1000)),
      valueText: () => (state === 'idle' ? `Durée ${label(dur)}` : `Reste ${label(Math.ceil(remaining() / 1000))}`),
      onChange: v => { if (state === 'idle') setDur(v * 60, 'dial'); },
    });
    dial.el.classList.add('timer-dial');

    // Version compacte (petite largeur) : le temps en grand et une barre, sans cadran.
    const time = el('div', 'time focus-time');
    time.setAttribute('role', 'timer');
    const bar = el('div', 'bar');
    bar.setAttribute('aria-hidden', 'true');
    const fill = el('i');
    bar.append(fill);

    // Saisie manuelle sous le cadran.
    const manual = el('div', 'timer-manual');
    const field = (name, max) => {
      const wrap = el('label', 'timer-field');
      const input = Object.assign(el('input'), { type: 'text', inputMode: 'numeric', pattern: '[0-9]*', maxLength: String(max).length, autocomplete: 'off', enterKeyHint: 'done' });
      wrap.append(input, el('span', '', name === 'Minutes' ? 'min' : 's'));
      input.ariaLabel = name;
      return { wrap, input };
    };
    const mm = field('Minutes', 180), ss = field('Secondes', 59);
    const note = el('p', 'timer-note');
    note.id = `timer-note-${Math.random().toString(36).slice(2, 8)}`;
    note.setAttribute('aria-live', 'polite');
    for (const f of [mm, ss]) f.input.setAttribute('aria-describedby', note.id);
    const fields = el('div', 'timer-fields');
    fields.setAttribute('role', 'group');
    fields.ariaLabel = 'Durée exacte';
    fields.append(mm.wrap, el('span', 'timer-colon', ':'), ss.wrap);
    manual.append(fields, note);

    const go = button('primary', 'Démarrer', toggle);
    const reset = button('ghost', 'Remettre', () => { stop(); state = 'idle'; left = dur * 1000; persist(); draw(); });
    const ctrl = el('div', 'ctrl');
    ctrl.append(go, reset);

    function setDur(sec, from) {
      if (state !== 'idle' || !okDur(sec)) return;
      dur = sec;
      left = dur * 1000;
      // Pas de boucle : chaque source met à jour les autres, jamais elle-même.
      if (from !== 'dial') dial.set(dur / 60, { exact: true });
      if (from !== 'fields') fillFields();
      note.textContent = '';
      note.classList.remove('bad');
      persist();
      draw();
    }
    function fillFields() { mm.input.value = String(Math.floor(dur / 60)); ss.input.value = two(dur % 60); }
    function readFields() {
      const m = mm.input.value.trim(), s = ss.input.value.trim();
      if (!/^\d{1,3}$/.test(m || '0') || !/^\d{1,2}$/.test(s || '0')) return bad('Seulement des chiffres.');
      const mi = Number(m || 0), se = Number(s || 0);
      if (se > 59) return bad('Les secondes vont de 0 à 59.');
      const total = mi * 60 + se;
      if (total < MIN_DUR || total > MAX_DUR) return bad('Choisis entre 0:10 et 180:00.');
      setDur(total, 'fields');
      fillFields();
    }
    function bad(text) {
      note.textContent = text;
      note.classList.add('bad');
      for (const f of [mm, ss]) f.input.setAttribute('aria-invalid', 'true');
    }
    for (const f of [mm, ss]) {
      f.input.addEventListener('input', () => { f.input.value = f.input.value.replace(/\D/g, ''); f.input.removeAttribute('aria-invalid'); });
      f.input.addEventListener('change', readFields);
      f.input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); readFields(); } });
      f.input.addEventListener('focus', () => f.input.select());
    }

    function draw() {
      const rem = remaining(), sec = Math.ceil(rem / 1000), text = label(sec);
      time.textContent = text;
      fill.style.transform = `scaleX(${1 - rem / (dur * 1000)})`;
      if (state === 'run') document.title = `${text} — Renzvi`;
      const locked = state !== 'idle';
      for (const [n, b] of presets) { b.disabled = locked; b.setAttribute('aria-pressed', n * 60 === dur); }
      mm.input.disabled = ss.input.disabled = locked;
      dial.disable(locked);
      if (locked) dial.show(rem / 60000); else dial.refresh();
      if (locked && !note.classList.contains('bad')) note.textContent = 'Remets à zéro pour changer la durée.';
      else if (!locked && note.textContent === 'Remets à zéro pour changer la durée.') note.textContent = '';
      go.textContent = state === 'run' ? 'Pause' : state === 'pause' ? 'Reprendre' : 'Démarrer';
      meta.textContent = state === 'run' ? `En cours · ${text}` : state === 'pause' ? `En pause · ${text}` : `Aujourd'hui : ${minutes} min`;
    }
    function stop() {
      clearInterval(ticker);
      ticker = null;
      document.title = pageTitle;
    }
    function tick() {
      if (state !== 'run') return;
      if (endAt - Date.now() <= 0) finish(); else draw();
    }
    function startTicker() {
      clearInterval(ticker);
      // L'heure de fin fait foi : un onglet en arrière-plan ralentit les minuteries du navigateur, sans fausser le compte.
      ticker = setInterval(tick, 250);
    }
    function finish() {
      if (state !== 'run') return; // compté une seule fois
      stop();
      state = 'idle';
      left = dur * 1000;
      const today = dayKey(new Date());
      if (today !== day) { day = today; minutes = 0; }
      const credit = Math.round(dur / 60);
      minutes += credit;
      if (credit) log = { ...log, [today]: (log[today] ?? 0) + credit };
      persist();
      document.title = 'Session terminée — Renzvi';
      draw();
    }
    function toggle() {
      if (state === 'run') { left = Math.max(0, endAt - Date.now()); state = 'pause'; stop(); }
      else { endAt = Date.now() + (state === 'pause' ? left : dur * 1000); state = 'run'; startTicker(); }
      persist();
      draw();
    }
    // Pour le dock de l'espace Study : le même moteur, lu et piloté de l'extérieur, sans second minuteur.
    const liveApi = () => ({ state, ms: remaining(), toggle });
    window.renzviMinuteurLive = liveApi;
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);

    fillFields();
    body.append(choices, dial.el, time, bar, manual, ctrl);
    if (state === 'run') { if (endAt <= Date.now()) finish(); else startTicker(); }
    draw();
    return () => { stop(); dial.destroy(); document.removeEventListener('visibilitychange', onVisible); if (window.renzviMinuteurLive === liveApi) window.renzviMinuteurLive = null; };
  };
})();
