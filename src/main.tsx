import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Force update of any stale Service Worker (PWA) so users always get the latest UI.
// Without this, cached bundles from previous deploys can show outdated views
// (e.g. masked CPFs that were already replaced in the source code).
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => {
      reg.update().catch(() => {});
    });
  });

  // When a new SW takes control, reload the page once so the user sees fresh assets.
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
