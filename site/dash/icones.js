// Icônes des widgets (piste A « trait fin », choisie par Damien le 17 nov.) : grille de 24, trait 1,5, une idée par icône.
// renzviIcone(id) → un <svg> (catalogue) ; renzviIconeUrl(id) → une image pour un masque CSS (états vides).
(() => {
  const I = {
    cahier: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M12.5 8h3.5M12.5 11.5h3.5"/>',
    cartes: '<path d="M7 5h11.5A2.5 2.5 0 0 1 21 7.5v7"/><rect x="3" y="8" width="14.5" height="11" rx="2.2"/><path d="M7 12.5h6.5M7 15.5h4"/>',
    revisions: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/>',
    quiz: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5Z"/><path d="M10 8.6a2 2 0 1 1 2.7 1.9c-.5.2-.7.6-.7 1v.3"/><path d="M12 14h.01"/>',
    schemas: '<circle cx="6.5" cy="12" r="3"/><rect x="14" y="3.5" width="6.5" height="5" rx="1.5"/><rect x="14" y="15.5" width="6.5" height="5" rx="1.5"/><path d="M9.2 10.6 14 6.6M9.2 13.4 14 17.4"/>',
    guide: '<path d="M12 21V3M12 5h6l2 2.25L18 9.5h-6M12 12H6l-2 2.25L6 16.5h6"/>',
    etude: '<circle cx="5" cy="17" r="1.5"/><circle cx="10" cy="7" r="1.5"/><circle cx="19" cy="5" r="1.5"/><circle cx="16" cy="16" r="1.5"/><path d="M5.7 15.6 9.3 8.4M11.5 6.7l6-1.3M18.6 6.5l-2.2 8M14.5 16.1l-8 .8"/>',
    vol: '<path d="M21 3 3 10.5l7 3 3 7.5Z"/><path d="m10 13.5 4.5-4.5"/>',
    taches: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><path d="m5.6 7.1 1.2 1.2 2.1-2.4"/><path d="M14 7h6.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><path d="M14 17h6.5"/>',
    heure: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    minuteur: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V10M10 2.5h4M18.5 6.5l1-1"/>',
    semaine: '<path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="6" rx="1"/><rect x="10.5" y="6" width="3" height="11" rx="1"/><rect x="15.5" y="9" width="3" height="8" rx="1"/>',
    notes: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h8L19 7.5v12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5Z"/><path d="M14.5 3v4.5H19"/><path d="M8.5 12h7M8.5 15.5h4.5"/>',
    habitudes: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4h-4"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    respiration: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="9" stroke-dasharray="1.5 3"/>',
    ambiance: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4" height="6.5" rx="1.5"/><rect x="16.5" y="14" width="4" height="6.5" rx="1.5"/>',
    compte: '<path d="M6.5 3h11M6.5 21h11M7.5 3v3.5L12 12l4.5-5.5V3M7.5 21v-3.5L12 12l4.5 5.5V21"/>',
    raccourcis: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
    playlist: '<path d="M4 6h10M4 11h10M4 16h6"/><path d="M18 18V7l3-1"/><circle cx="16" cy="18" r="2"/>',
    pause: '<path d="M4.5 10h12v4.5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5Z"/><path d="M16.5 11.5h1.3a2.2 2.2 0 0 1 0 4.5h-1.6"/><path d="M8.5 3.5c-.8 1 .8 1.9 0 3M12.5 3.5c-.8 1 .8 1.9 0 3"/>',
    lecture: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5c-3.5-.5-6.5 0-8.5 1.5Z"/><path d="M12 6.5V20"/><path d="M15.5 5.4v5l1.5-1.2 1.5 1.2V5.1"/>',
    jardin: '<path d="M12 21v-9"/><path d="M12 12c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5Z"/><path d="M12 14.5c0-3-2.3-5-5.5-5 0 3 2.3 5 5.5 5Z"/><path d="M7 21h10"/>',
    dessin: '<path d="M4.5 19.5 5.5 15 16.5 4a2.1 2.1 0 0 1 3 3L8.5 18Z"/><path d="m14.5 6 3 3"/>',
    coloriage: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-.8 2-1.8 0-1.4-1.2-1.7-1.2-3 0-1 .8-1.7 1.8-1.7h2.2a3.7 3.7 0 0 0 3.7-3.7C20.5 6.6 16.7 3.5 12 3.5Z"/><circle cx="7.8" cy="11" r="1"/><circle cx="10" cy="7.3" r="1"/><circle cx="14.6" cy="7.5" r="1"/>',
    puzzle: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/>',
    tangram: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 3.5l17 17M20.5 3.5 12 12M7.75 16.25 12 12"/>',
    fenetre: '<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M12 3.5v17M4.5 12h15"/>',
    ambiances: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
    cinq: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12l4.25-7.36"/>',
    dictee: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>',
    repas: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 21V3c-2 1.5-3 4-3 7v3h3"/>',
    aujourdhui: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    agenda: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01"/>',
    courses: '<path d="M3 4h2l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6"/><circle cx="9.5" cy="19.5" r="1.2"/><circle cx="17" cy="19.5" r="1.2"/>',
    depenses: '<path d="M4 8V7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="16.5" height="11.5" rx="2.5"/><path d="M16 14h.01"/>',
    inspiration: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="9.5" r="1.5"/><path d="m3.5 17 5-4.5 4 3.5 3-2.5 5 4"/>',
    abos: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h3"/>',
  };
  const svg = (id, stroke = 'currentColor') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${I[id]}</svg>`;
  window.renzviIcone = id => {
    if (!I[id]) return null;
    const t = document.createElement('template');
    t.innerHTML = svg(id);
    const s = t.content.firstChild;
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'w-ic');
    return s;
  };
  // Pour un masque, la couleur du trait importe peu : seule la forme compte.
  window.renzviIconeUrl = id => (I[id] ? `url("data:image/svg+xml,${encodeURIComponent(svg(id, '#000'))}")` : null);
  window.renzviIcones = Object.keys(I);
})();
