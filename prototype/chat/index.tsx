// Point d'entrée de l'îlot chargé par le dashboard (site/dashboard.html, labo seulement). Construit par scripts/build-chat.mjs.
import React from "react";
import { createRoot } from "react-dom/client";
import { ChatIA } from "./ChatIA";

if (!document.getElementById("renzvi-chat")) {
  const host = document.createElement("div");
  host.id = "renzvi-chat";
  document.body.append(host);
  createRoot(host).render(<ChatIA />);
}
