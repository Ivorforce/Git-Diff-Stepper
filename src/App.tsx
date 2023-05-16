import React, { createRef, useRef } from 'react';
import ReactDOM from "react-dom/client";
import './App.css';

import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import { MonacoLogController, FileInfo } from './MonacoLogController';
import { emit, listen } from '@tauri-apps/api/event'
import { useEffect } from 'react';
import Editor from "@monaco-editor/react";
import { TextZone } from './ViewZones';
import { addSetLanguageActions } from './SetLanguage';

loader.config({ monaco });

function createPatchEditor(text: string, language: string, textZone: TextZone, decorationClassName?: string) {
    const div = document.createElement("div");

    async function handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: any) {
        textZone.onMount(editor);

        if (decorationClassName) {
            editor.createDecorationsCollection([{
                range: new monaco.Range(0, 0, editor.getModel()?.getLineCount, 0),
                options: { isWholeLine: true, className: decorationClassName }
            }]);
        }
    };

    const secondEditor = <Editor
        onMount={handleEditorDidMount}
        theme="vs-dark-plus"

        language={language}
        value={text}

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

    const root = ReactDOM.createRoot(div);
    root.render(secondEditor);

    textZone.domNode = div;
    div.style.zIndex = '10'; // without this, the viewzone is not interactive. VSCode does the same.
}

function App() {
    let logController: MonacoLogController | undefined;

    useEffect(() => {
        const unlisten = listen('openFile', async (event) => {
            logController?.setFile(event.payload as FileInfo);
        });

        // Destructor destroys the listener: https://github.com/tauri-apps/tauri/discussions/5194
        return () => {
            unlisten.then(f => f());
        };
    }, []);

    async function handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: any) {
        let logController_ = new MonacoLogController(editor, createPatchEditor);
        logController = logController_;

        addSetLanguageActions(editor);
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow, () => logController_.prev());
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.RightArrow, () => logController_.next());
    }

    return <Editor
        height="calc(100vh - 30px)"  // TODO This shouldn't be here but otherwise the size is 5px
        width="calc(100vw - 30px)"
        onMount={handleEditorDidMount}
        theme="vs-dark-plus"
        options={{
            minimap: { enabled: false },
            renderLineHighlight: "none",

            scrollBeyondLastLine: false,
        }}
        className='main-editor'
    />
}

export default App;
