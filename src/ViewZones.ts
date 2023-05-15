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

    constructor(
        readonly line: number,
        readonly height: number,
    ) {
        // this.domNode.style.zIndex = '10'; // without this, the viewzone is not interactive
        this.afterLineNumber = line;
        this.afterColumn = 1;
        this.heightInLines = height;
    }
}

export function gatherViewzones(patches: Patch[], direction: PatchDirection, createEditor: Function): TextZone[] {
    let viewZones: TextZone[] = [];

    for (let patch of patches) {
        if (patch.addCount > 0) {
            // - 1 because we want to insert *before* the line - viewZones use "afterLineNumber".
            const start = direction == PatchDirection.Forwards ? patch.oldFilePos + patch.delCount - 1 : patch.newFilePos - 1;
            const height = direction == PatchDirection.Forwards ? patch.addCount : patch.delCount;

            let textZone = new TextZone(start, height); 
            createEditor(direction == PatchDirection.Forwards ? patch.addedLines : patch.removedLines, textZone);
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

export function destroyViewzones(editor: monaco.editor.IStandaloneCodeEditor, viewZones: TextZone[]) {
    editor.changeViewZones(accessor => {
        for (let x of viewZones) {
            accessor.removeZone(x._id!);
        }
    });
}