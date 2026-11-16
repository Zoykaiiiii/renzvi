// Le bouton micro VoicePill (components/voice-pill, React Bits) pour le widget Dictée du dashboard (site/dash/dictee.js).
// Construit par scripts/build-dictee.mjs. Le widget appelle window.renzviVoicePill(conteneur, props).
import { createRoot } from 'react-dom/client';
import VoicePill from '../components/voice-pill/VoicePill';

window.renzviVoicePill = (el, props) => {
  const root = createRoot(el);
  const render = p => root.render(<VoicePill {...p} />);
  render(props);
  return { update: render, unmount: () => root.unmount() };
};
