// La traduction utilise le modèle du navigateur. Les valeurs des champs et les données de l'application restent en place.
(() => {
  const source = 'fr';
  const languages = 'ar bg bn cs da de el en es fi fr he hi hr hu id it ja kn ko lt mr nl no pl pt ro ru sk sl sv ta te th tr uk vi zh zh-Hant'.split(' ');
  const storageKey = 'renzvi:language';
  const attributes = ['aria-label', 'aria-description', 'placeholder', 'title', 'alt'];
  const untouched = [
    'script,style,noscript,template,svg,pre,code,iframe,canvas,[translate=no],[contenteditable]:not([contenteditable=false])',
    '.cahier-livre-texte,.carnet-notetext,.carnet-quote,.cartes-face,.cartes-deck,#renzvi-chat-panel ol',
  ].join(',');
  const hidden = '[hidden],dialog:not([open]),[popover]:not(:popover-open)';
  const originals = new WeakMap();
  const root = document.documentElement;
  let translator, locale = source, generation = 0, changing = 0;
  let cache = new Map();
  let preferred = source;
  try { preferred = localStorage.getItem(storageKey) ?? source; } catch {}
  if (!languages.includes(preferred)) preferred = source;

  const optionName = language => {
    try { return new Intl.DisplayNames([language], { type: 'language' }).of(language); }
    catch { return language; }
  };
  const keep = language => {
    preferred = language;
    try { localStorage.setItem(storageKey, language); } catch {}
  };
  const words = {
    section: 'Langue',
    choose: 'Langue du site',
    apply: 'Appliquer',
    loading: 'Préparation de la traduction…',
    unavailable: 'Utilise la traduction de page de ton navigateur.',
    pair: 'Cette langue n’est pas disponible sur cet appareil.',
    resume: 'Applique ta langue pour reprendre la traduction.',
  };
  const controls = [];

  function lookup(text) {
    if (!cache.has(text)) {
      const model = translator;
      const entries = cache;
      if (entries.size >= 1000) entries.delete(entries.keys().next().value);
      entries.set(text, model.translate(text).catch(() => { entries.delete(text); return text; }));
    }
    return cache.get(text);
  }

  function update(node, key, restore) {
    const read = () => key ? node.getAttribute(key) : node.data;
    const write = value => {
      if (key) node.setAttribute(key, value);
      else node.data = value;
    };
    const value = read();
    let slots = originals.get(node), slot = slots?.get(key);
    if (slot && value !== slot.result && value !== slot.original) slot = null;
    if (restore) {
      if (slot && value === slot.result) write(slot.original);
      return;
    }
    if (!value || !/\p{L}/u.test(value)) return;
    if (!slot) {
      if (!slots) originals.set(node, slots = new Map());
      slots.set(key, slot = { original: value, result: null, generation: 0 });
    }
    if (slot.generation === generation) return;
    const epoch = slot.generation = generation;
    const text = slot.original.trim();
    const offset = slot.original.indexOf(text);
    lookup(text).then(translated => {
      if (generation !== epoch || slots.get(key) !== slot || !node.isConnected ||
          (read() !== slot.original && read() !== slot.result)) return;
      slot.result = slot.original.slice(0, offset) + translated + slot.original.slice(offset + text.length);
      if (read() !== slot.result) write(slot.result);
    });
  }

  function scan(node, restore = false) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.parentElement?.closest(untouched + ',textarea,option:not([value])') &&
          (restore || !node.parentElement?.closest(hidden))) update(node, '', restore);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || node.closest(untouched) || (!restore && node.closest(hidden))) return;
    for (const key of attributes) if (node.hasAttribute(key)) update(node, key, restore);
    for (const child of node.childNodes) scan(child, restore);
  }

  const observer = new MutationObserver(entries => {
    // Les rendus d'un widget peuvent modifier ensemble son texte, son titre et sa visibilité.
    const nodes = new Set();
    for (const entry of entries) {
      if (entry.type === 'childList') for (const child of entry.addedNodes) nodes.add(child);
      else nodes.add(entry.target);
    }
    for (const node of nodes) scan(node);
  });
  const applyToPage = () => {
    scan(document.body);
    for (const head of document.head.querySelectorAll('title')) scan(head);
  };
  addEventListener('toggle', event => { if (translator && (event.newState === 'open' || event.target.open)) scan(event.target); }, true);

  function status(key, percent = '') {
    for (const control of controls) {
      const node = control.status;
      node.textContent = key ? control.copy[key] + percent : '';
    }
  }

  function updatePicker() {
    for (const control of controls) {
      control.copy = { ...words };
      control.summary.textContent = words.section;
      control.select.ariaLabel = words.choose;
      control.select.value = locale;
      control.button.textContent = words.apply;
      if (!translator) continue;
      const epoch = generation;
      for (const [key, text] of Object.entries(words)) lookup(text).then(value => {
        if (epoch !== generation) return;
        control.copy[key] = value;
        if (key === 'section') control.summary.textContent = value;
        if (key === 'choose') control.select.ariaLabel = value;
        if (key === 'apply') control.button.textContent = value;
      });
    }
  }

  async function changeLanguage(language, userRequested) {
    const request = ++changing;
    if (language === locale) { keep(language); status(''); return; }
    let next;
    if (language !== source) {
      if (!globalThis.Translator) { status('unavailable'); return; }
      const options = { sourceLanguage: source, targetLanguage: language };
      try {
        if (!userRequested && await Translator.availability(options) !== 'available') {
          if (request === changing) status('resume');
          return;
        }
        status('loading');
        next = await Translator.create({ ...options, monitor(monitor) {
          monitor.addEventListener('downloadprogress', event => {
            if (request === changing) status('loading', ` ${Math.round(event.loaded * 100)} %`);
          });
        } });
        if (request !== changing) { next.destroy(); return; }
      } catch {
        if (request === changing) status('pair');
        return;
      }
    }
    generation++;
    observer.disconnect();
    translator?.destroy();
    translator = next;
    locale = language;
    keep(language);
    cache = new Map();
    root.lang = language;
    root.dataset.translationSource = source;
    root.toggleAttribute('data-translating-rtl', ['ar', 'he'].includes(language));
    status('');
    updatePicker();
    if (language === source) {
      scan(document.body, true);
      for (const head of document.head.querySelectorAll('title')) scan(head, true);
    } else {
      applyToPage();
      observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...attributes, 'open', 'hidden'] });
      observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    }
    document.dispatchEvent(new Event('renzvi:language'));
  }

  for (const host of document.querySelectorAll('[data-language-picker]')) {
    host.translate = false;
    const details = document.createElement('details');
    details.className = 'language-picker';
    const summary = document.createElement('summary');
    summary.textContent = words.section;
    const form = document.createElement('form');
    const select = document.createElement('select');
    select.dataset.native = '';
    select.ariaLabel = words.choose;
    const button = document.createElement('button');
    button.type = 'submit';
    button.textContent = words.apply;
    const feedback = document.createElement('p');
    feedback.setAttribute('role', 'status');
    if (globalThis.Translator) {
      for (const lang of languages) select.add(new Option(optionName(lang), lang, false, lang === preferred));
      form.append(select, button);
      form.addEventListener('submit', event => { event.preventDefault(); void changeLanguage(select.value, true); });
    } else {
      feedback.textContent = words.unavailable;
      feedback.lang = source;
    }
    form.append(feedback);
    details.append(summary, form);
    host.append(details);
    controls.push({ summary, select, button, status: feedback, copy: { ...words } });
  }
  if (preferred !== source && globalThis.Translator) void changeLanguage(preferred, false);
})();
