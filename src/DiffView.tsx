import React from 'react';
import ReactDOM from 'react-dom';
import { renderToStaticMarkup } from "react-dom/server"
import { readTextFile } from '@tauri-apps/api/fs';

import * as monaco from 'monaco-editor';
import Editor, { Monaco } from '@monaco-editor/react';
import { useEffect } from 'react';
import Patch from './patch';

class EditorWebviewZone implements monaco.editor.IViewZone {
    readonly domNode: HTMLElement;
    readonly afterLineNumber: number;
    readonly afterColumn: number;
    readonly heightInLines: number;

    private _id?: string;

    constructor(
        domNode: HTMLElement,
        readonly editor: monaco.editor.IStandaloneCodeEditor,
        readonly line: number,
        readonly height: number,
    ) {
        this.domNode = domNode;
        this.domNode.style.zIndex = '10'; // without this, the webview is not interactive
        this.afterLineNumber = line;
        this.afterColumn = 1;
        this.heightInLines = height;
        editor.changeViewZones(accessor => this._id = accessor.addZone(this));
    }

    dispose(): void {
        this.editor.changeViewZones(accessor => this._id && accessor.removeZone(this._id));
    }
}

export class DiffViewProps {
    handleEditorDidMount: Function; //Here,you can define your class level properties
}

export class DiffView extends React.Component<DiffViewProps> {
    editor: monaco.editor.IStandaloneCodeEditor | null;
    viewZones: EditorWebviewZone[] = [];
    currentDiff?: Patch[];
    
    deleteDecorations = monaco.editor.IEditorDecorationsCollection;

    render() {        
        const this_ = this;
        async function handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) {
            this_.editor = editor;
            this_.deleteDecorations = editor.createDecorationsCollection();
            this_.props.handleEditorDidMount?.(editor, monaco);
        }

        return (
            <Editor
                height="97vh"
                width="97%"
                onMount={handleEditorDidMount}
                theme="vs-dark"
                options={{
                    minimap: { enabled: false },
                    renderLineHighlight: "none"    
                }}
                className='main-editor'
            />
        );
    }

    setContents(contents: string) {
        this.viewZones.forEach(x => x.dispose());
        this.viewZones = [];
        this.deleteDecorations.clear();

        monaco.editor.setModelLanguage(this.editor!.getModel()!, "python");  // FIXME
        this.editor!.getModel()!.setValue(contents);
    }

    setDiff(diff: Patch[]) {
        this.currentDiff = diff;

        let deleteDecorations: monaco.editor.IModelDeltaDecoration[] = [];

        for (let patch of diff) {
            if (patch.delCount > 0) {
                deleteDecorations.push({
                    range: new monaco.Range(patch.oldFilePos, 0, patch.oldFilePos + patch.delCount - 1, 0),
                    options: {
                      isWholeLine: true,
                      className: 'deleteLine',
                    }
                  });
                }

            if (patch.addCount > 0) {
                async function handleEditorDidMount(editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) {
                    monaco.editor.setModelLanguage(editor!.getModel()!, "python");  // FIXME
                    editor!.getModel()!.setValue(patch.addedLines.join("\n"));

                    editor.createDecorationsCollection([{
                        range: new monaco.Range(0, 0, patch.addCount, 0),
                        options: {
                          isWholeLine: true,
                          className: 'addLine',
                        }
                      }])
                };
                
                const secondEditor = <Editor
                    onMount={handleEditorDidMount}
                    theme="vs-dark"
                    options={{
                        readOnly: true,
        
                        glyphMargin: false,
                        folding: false,
                        lineNumbers: "off",
                        lineDecorationsWidth: 0,
                        lineNumbersMinChars: 0,
        
                        minimap: { enabled: false },
                        renderLineHighlight: "none",
        
                        scrollBeyondLastLine: false,
                        scrollbar: {
                            vertical:"hidden",
                            horizontal: "hidden",
                            handleMouseWheel:false,
                        },
                    }}
                />;
        
                const div = document.createElement("div");
                ReactDOM.render(secondEditor, div);
        
                const viewZone = new EditorWebviewZone(div, this.editor!, patch.oldFilePos + patch.delCount - 1, patch.addCount);
                this.viewZones.push(viewZone);
            }
        }

        this.deleteDecorations.set(deleteDecorations);
    }

    applyCurrentDiff() {
        if (!this.currentDiff) {
            return;
        }

        let doc = this.editor!.getModel()!;
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = []; 

        for (let patch of this.currentDiff) {
            // TODO Should probably be eol sensitive...
            let replacement = patch.addCount > 0 ? patch.addedLines.join("\n") + "\n" : "";

            // If we need to insert at the end of the file, just use the last line's end
            let removeStart = doc.getLineCount() === patch.oldFilePos ? doc.getLineCount() : patch.oldFilePos;

            if (patch.delCount > 0) {
                // Use the start of the next line if available, otherwise just delete till the end.
                edits.push({
                    range: removeStart + patch.delCount - 1 < doc.getLineCount()
                        ? new monaco.Range(removeStart, 0, removeStart + patch.delCount, 0)
                        : new monaco.Range(removeStart, 0, removeStart + patch.delCount - 1, doc.getLineLength(removeStart + patch.delCount - 1)),
                    text: replacement
            });
            }
            else {
                edits.push({
                    range: new monaco.Range(removeStart, 0, removeStart, 0),
                    text: replacement
                });
            }
		}

        this.editor?.executeEdits(null, edits);
        this.editor?.pushUndoStop();

        this.currentDiff = [];

        // TODO Animate Away
        this.viewZones.forEach(x => x.dispose());
        this.viewZones = [];
        this.deleteDecorations.clear();
    }
}