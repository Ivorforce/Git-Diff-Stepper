import * as monaco from 'monaco-editor';
import { transition } from './Repeater';
import { smoothstep_one } from './Mafs';
import Patch, { PatchDirection } from './Patches';

export class TextZone implements monaco.editor.IViewZone {
    domNode: HTMLElement;
    editor: monaco.editor.IStandaloneCodeEditor;
    afterLineNumber: number;
    afterColumn: number;
    heightInLines: number;

    _id?: string;

    private _onMount?: Function;
    editorPromise: Promise<monaco.editor.IStandaloneCodeEditor>;

    constructor(
        readonly line: number,
        readonly height: number,
    ) {
        this.afterLineNumber = line;
        this.afterColumn = 1;
        this.heightInLines = height;
        this.editorPromise = new Promise(resolve => this._onMount = (editor) => resolve(editor));
    }

    onMount(editor: monaco.editor.IStandaloneCodeEditor) {
        this.editor = editor;
        this._onMount?.(editor)
    }
}

export function gatherViewzones(patches: Patch[], direction: PatchDirection, createEditor: Function): TextZone[] {
    let viewZones: TextZone[] = [];

    for (let patch of patches) {
        const height = direction == PatchDirection.Forwards ? patch.addCount : patch.delCount;

        if (height > 0) {
            // - 1 because we want to insert *before* the line - viewZones use "afterLineNumber".
            const start = direction == PatchDirection.Forwards ? patch.oldFilePos + patch.delCount - 1 : patch.newFilePos - 1;

            let textZone = new TextZone(start, height); 
            createEditor(
                (direction == PatchDirection.Forwards ? patch.addedLines : patch.removedLines).join("\n"),
                textZone
            );
            viewZones.push(textZone);
        }
    }

    return viewZones;
}

export function transitionInViewzones(editor: monaco.editor.IStandaloneCodeEditor, viewZones: TextZone[]) {
    let zonesAndHeight: [TextZone, number][] = viewZones.map(x => [x, x.heightInLines]);

    editor.changeViewZones(accessor => {
        for (let x of zonesAndHeight) {
            x[0].heightInLines = 0;
            x[0]._id = accessor.addZone(x[0]);
        } 
    });

    // TODO Configurable duration?
    transition(60, 0.2, (ratio: number) => {
        editor.changeViewZones(accessor => {
            for (let x of zonesAndHeight) {
                x[0].heightInLines = (smoothstep_one(ratio)) * x[1]
                accessor.layoutZone(x[0]._id!);
            }
        });
    });
}

export function transitionOutViewzones(editor: monaco.editor.IStandaloneCodeEditor, viewZones: TextZone[]) {
    let zonesAndHeight: [TextZone, number][] = viewZones.map(x => [x, x.heightInLines]);

    // TODO Configurable duration?
    transition(60, 0.2, (ratio: number) => {
        editor.changeViewZones(accessor => {
            if (ratio >= 0.99) {
                for (let x of zonesAndHeight) {
                    accessor.removeZone(x[0]._id!);
                    x[0]._id = undefined;
                }
            }
            else {
                for (let x of zonesAndHeight) {
                    x[0].heightInLines = (1 - smoothstep_one(ratio)) * x[1]
                    accessor.layoutZone(x[0]._id!);
                }
            }
        });
    });
}

export function insertInterspersedText(editor: monaco.editor.IStandaloneCodeEditor, viewZones: TextZone[]): monaco.editor.IIdentifiedSingleEditOperation[] {
    destroyViewzones(editor, viewZones);

    return viewZones.map(viewZone => {
        return {
            // + 1 because we want to insert AFTER that line.
            range: { startLineNumber: viewZone.afterLineNumber + 1, endLineNumber: viewZone.afterLineNumber + 1, startColumn: 0, endColumn: 0 },
            text: viewZone.editor.getModel()!.getValue() + "\n"  // Last newline is intentionally left out of the patch editor
        };
    });
}

export function postEditPosition(position: number, edits: monaco.editor.IIdentifiedSingleEditOperation[]): number {
    // I imagine this algorithm as conveyor belts: If you have an index, you're in that 2D space.
    // e.g. with a 1 you're in the space between 1 and 2.

    // Note that this simple algorithm does work if any edits overlap.

    const oldPosition = position;

    for (let edit of edits) {
        // Move us back first.
        const removeLineCount = edit.range.endLineNumber - edit.range.startLineNumber;
        // If we're on the conveyor belt, move us to its start. If we're past it, move us by its entire length
        position -= Math.max(0, Math.min(removeLineCount, oldPosition - edit.range.startLineNumber));

        // If we're at least past the piston's end, move us forward. Otherwise, do nothing.
        if (oldPosition >= edit.range.endLineNumber) {
            // TODO Should be EOL sensitive
            const newlineCount = (edit.text!.match(/\n/g) || []).length;
            position += newlineCount;
        }
    }

    return position;
}

export function insertDecorationsPostEdit(collection: monaco.editor.IEditorDecorationsCollection, viewZones: TextZone[], edits: monaco.editor.IIdentifiedSingleEditOperation[]) {
    collection.set(viewZones.map(viewZone => {
        let position = Math.round(postEditPosition(viewZone.afterLineNumber + 0.9, edits) + 0.1);
        const lineCount = viewZone.heightInLines;

        // TODO eh, shoddy way of finding our decoration.
        const referenceOptions = viewZone.editor.getModel()!.getAllDecorations().filter(x => x.options.className?.includes("Code"))[0].options;
        return {
            range: { startLineNumber: position, startColumn: 0, endLineNumber: position + lineCount - 1, endColumn: 0 },
            options: referenceOptions
        }
    }));
}

export function destroyViewzones(editor: monaco.editor.IStandaloneCodeEditor, viewZones: TextZone[]) {
    editor.changeViewZones(accessor => {
        for (let x of viewZones) {
            accessor.removeZone(x._id!);
        }
    });
}