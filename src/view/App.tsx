import React from 'react';
import ReactDOM from "react-dom/client";
import './App.css';

import * as monaco from 'monaco-editor';
import { MonacoLogController, FileInfo } from '../monaco/MonacoLogController';
import { EventCallback, emit, listen } from '@tauri-apps/api/event'
import { useEffect } from 'react';
import Editor from "@monaco-editor/react";
import { TextZone } from '../monaco/ViewZones';
import { addSetLanguageActions } from '../monaco/SetLanguage';
import { addSetThemeActions, getBackgroundColor } from '../monaco/Themes';
import { currentTheme, customThemes, onUpdateTheme } from '../main';

function listenReact<T>(name: string, fun: EventCallback<T>) {
    useEffect(() => {
        const unlisten = listen(name, fun);

        // Destructor destroys the listener: https://github.com/tauri-apps/tauri/discussions/5194
        return () => {
            unlisten.then(f => f());
        };
    }, []);
}

function createPatchEditor(language: string, textZone: TextZone) {
    async function handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: any) {
        textZone.onMount(editor);

        editor.createDecorationsCollection([{
            range: new monaco.Range(0, 0, 9999, 0),
            // range: new monaco.Range(0, 0, editor.getModel()?.getLineCount, 0),  // For some reason this doesn't work right now.
            options: textZone.decorationOptions
        }]);
    };

    const secondEditor = <Editor
        onMount={handleEditorDidMount}

        theme={currentTheme}

        // language / value inputs are tracked, "default" versions are only for the initial value
        defaultLanguage={language}
        defaultValue={textZone.initialText}

        options={{
            glyphMargin: false,
            folding: false,
            lineNumbers: "off",
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 0,

            minimap: { enabled: false },
            renderLineHighlight: "none",

            scrollBeyondLastLine: false,
            scrollbar: {
                vertical: "hidden",
                horizontal: "hidden",
                handleMouseWheel: false,
            },
            overviewRulerLanes: 0,
        }}
    />;

    const div = document.createElement("div");
    const root = ReactDOM.createRoot(div);
    root.render(secondEditor);

    textZone.domNode = div;
    div.style.zIndex = '10'; // without this, the viewzone is not interactive. VSCode does the same.
}

function App() {
    let logController: MonacoLogController | undefined;

    listenReact('openFile', async (event) => {
        logController?.setFile(event.payload as FileInfo);
    });

    listenReact('saveFile', async (event) => {
        logController?.saveFile();
    });

    listenReact('stepNext', async (event) => {
        logController?.next();
    });

    listenReact('stepPrev', async (event) => {
        logController?.prev()
    });

    async function handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: any) {
        // This shouldnt be needed, but it needs to be run once to update the background color for the first time.
        onUpdateTheme(currentTheme, editor);

        let logController_ = new MonacoLogController(editor, createPatchEditor);
        logController = logController_;

        addSetLanguageActions(editor);
        addSetThemeActions(editor, customThemes, onUpdateTheme);
    }

    return <Editor
        height="calc(100vh - 30px)"  // TODO This shouldn't be here but otherwise the size is 5px
        width="calc(100vw - 30px)"

        theme={currentTheme}

        onMount={handleEditorDidMount}
        options={{
            minimap: { enabled: false },
            renderLineHighlight: "none",

            scrollBeyondLastLine: false,
        }}
        className='main-editor'
    />
}

export default App;
