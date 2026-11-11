import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App.tsx";

// Tras un deploy, un chunk viejo puede dejar de existir: una recarga trae el HTML nuevo.
// La marca en sessionStorage evita un bucle de recargas.
window.addEventListener("vite:preloadError", () => {
  const clave = "chunk-reload";
  if (!sessionStorage.getItem(clave)) {
    sessionStorage.setItem(clave, "1");
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
