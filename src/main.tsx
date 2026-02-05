import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

(() => {
  const raw = localStorage.getItem("vikokoro.theme");
  if (raw === "dark" || raw === "light" || raw === "tokyoNight") {
    document.documentElement.dataset.theme = raw;
  } else {
    document.documentElement.dataset.theme = "dark";
  }
})();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
