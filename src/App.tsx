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

loader.config({ monaco });

function createPatchEditor(lines: string[], className: string, textZone: TextZone) {
    const div = document.createElement("div");

    async function handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: any) {
        editor.createDecorationsCollection([{
            range: new monaco.Range(0, 0, lines.length, 0),
            options: {
              isWholeLine: true,
              className: className,
            }
          }]);

          textZone.editor = editor;
    };

    const secondEditor = <Editor
        onMount={handleEditorDidMount}
        theme="vs-dark"

        language='python'  // TODO
        value={lines.join("\n")}

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

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow, () => logController_.prev());
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.RightArrow, () => logController_.next());        
    }

    return <Editor
        height="calc(100vh - 30px)"  // TODO This shouldn't be here but otherwise the size is 5px
        width="calc(100vw - 30px)"
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
            minimap: { enabled: false },
            renderLineHighlight: "none",

            scrollBeyondLastLine: false,
        }}
        className='main-editor'
    />
}

export default App;
