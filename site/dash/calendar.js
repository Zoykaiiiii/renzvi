// Le champ date garde sa valeur et sa saisie au clavier. Le calendrier React est chargé au premier clic.
(() => {
  const moduleUrl = new URL('calendar-picker.js', document.currentScript.src);
  let picker;
  window.renzviDateInput = (input, name = input.ariaLabel || 'Date') => {
    const wrap = document.createElement('span');
    wrap.className = 'date-with-calendar';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'date-calendar-trigger';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-label', `Choisir une date : ${name}`);
    trigger.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="2"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3"/></svg>';
    // Au doigt, toute la date ouvre le calendrier. Au clavier le champ reste éditable.
    const tapDate = event => {
      if (event.pointerType !== 'touch' || input.matches(':disabled,[readonly]')) return;
      event.preventDefault();
      trigger.focus({ preventScroll: true });
      trigger.click();
    };
    input.addEventListener('click', tapDate);
    trigger.onclick = async () => {
      if (input.matches(':disabled,[readonly]')) return;
      try {
        picker ??= import(moduleUrl.href);
        const { openCalendar } = await picker;
        openCalendar(input, name);
      } catch {
        picker = undefined;
        input.removeEventListener('click', tapDate);
        wrap.replaceWith(input);
        input.focus();
      }
    };
    wrap.append(input, trigger);
    return wrap;
  };
})();
