import React from "react";
import ReactDOM from "react-dom/client";
import App from "./view/App";
import "./view/styles.css";
import * as TextMate from "./monaco/TextMate";
import * as Themes from "./monaco/Themes";

await TextMate.setup();
await Themes.load();

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
