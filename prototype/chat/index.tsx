// Point d'entrée de l'îlot chargé par le dashboard. Construit par scripts/build-chat.mjs.
import React from "react";
import { createRoot } from "react-dom/client";
import { ChatIA, type Repondre } from "./ChatIA";

const service = () => (window as Window & { renzviZvi?: Repondre }).renzviZvi;
const ecouter = (change: () => void) => {
  document.addEventListener("renzvi:zvi", change);
  return () => document.removeEventListener("renzvi:zvi", change);
};
function ChatDashboard() {
  return <ChatIA repondre={React.useSyncExternalStore(ecouter, service)} />;
}

if (!document.getElementById("renzvi-chat")) {
  const host = document.createElement("div");
  host.id = "renzvi-chat";
  document.body.append(host);
  createRoot(host).render(<ChatDashboard />);
}
