import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

const el = document.getElementById("root");
// full-height background so the app fills the screen
document.documentElement.style.background = "#0a0c10";
document.body.style.margin = "0";
document.body.style.background = "#0a0c10";

createRoot(el).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
