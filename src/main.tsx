import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { disableLegacyServiceWorker } from "./lib/disableServiceWorker";

void disableLegacyServiceWorker().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
