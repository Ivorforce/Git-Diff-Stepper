import React from "react";
import ReactDOM from "react-dom/client";
import App from "./view/App";
import "./view/styles.css";
import * as TextMate from "./monaco/TextMate";
import * as Themes from "./monaco/Themes";
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';

loader.config({ monaco });

await TextMate.setup();
export const customThemes = await Themes.load();
export let currentTheme = "vs-dark-modern";

export function onUpdateTheme(theme: string, editor: monaco.editor.ICodeEditor) {
  document.body.style.backgroundColor = Themes.getBackgroundColor(editor);
  currentTheme = theme;
}

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
