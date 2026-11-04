// Aucune mise en cache et aucun mode hors connexion : les connexions et les données privées passent toujours par le réseau.
// Ce fichier existe seulement parce que certains navigateurs exigent un service worker pour proposer l'installation.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {}); // ne répond à rien : le navigateur charge la page normalement
