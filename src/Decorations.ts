import { TextZone, postEditPosition, transitionOutViewzones } from "./ViewZones";
import Patch, { PatchDirection } from "./Patches";
import * as monaco from 'monaco-editor';

export function gatherDecorations(patches: Patch[], direction: PatchDirection, options: monaco.editor.IModelDecorationOptions): monaco.editor.IModelDeltaDecoration[] {
    let decorations: monaco.editor.IModelDeltaDecoration[] = [];

    for (let patch of patches) {
        let start = direction === PatchDirection.Forwards ? patch.oldFilePos : patch.newFilePos;
        let length = direction === PatchDirection.Forwards ? patch.delCount : patch.addCount;

        if (length > 0) {
            decorations.push({
                range: new monaco.Range(start, 0, start + length - 1, 0),
                options: options
            });
        }
    }

    return decorations;
}

export function transitionInDecorations(editor: monaco.editor.IStandaloneCodeEditor, decorations: monaco.editor.IModelDeltaDecoration[], collection: monaco.editor.IEditorDecorationsCollection) {
    if (decorations.length == 0) {
        return;
    }

    let fadeInDecorations: monaco.editor.IModelDeltaDecoration[] = decorations.map(x => {
        return {
            range: x.range,
            options: { ...x.options, className: (x.options.className ?? "") + " fadeIn" },
        }
    });

    collection.set(fadeInDecorations);
    // TODO Adjustable time; requires css tho
    setTimeout(() => {
        collection.set(decorations);
    }, 500);
}

export function transitionOutDecorations(editor: monaco.editor.IStandaloneCodeEditor, collection: monaco.editor.IEditorDecorationsCollection) {
    if (collection.length == 0) {
        return;
    }

    let mappedDecorations: monaco.editor.IModelDeltaDecoration[] = editor.getModel()!.getAllDecorations()
        .filter(x => collection.has(x))
        .map(x => {
            return {
                range: x.range,
                options: { ...x.options, className: (x.options.className ?? "") + " fadeOut" },
            }
        })

    collection.set(mappedDecorations);
    // TODO Adjustable time; requires css tho
    setTimeout(() => collection.clear(), 500);
}

export function expandRange(range: monaco.IRange, fullLine: boolean): monaco.IRange {
    return fullLine ? {
        startLineNumber: range.startLineNumber,
        endLineNumber: range.endLineNumber + 1,
        startColumn: 0,
        endColumn: 0
    } : range;
}

export function deleteDecoratedText(editor: monaco.editor.IStandaloneCodeEditor, createEditor: Function, collection: monaco.editor.IEditorDecorationsCollection): [monaco.editor.IIdentifiedSingleEditOperation[], TextZone[]] {
    let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
    let viewzones: TextZone[] = [];

    for (let decoration of editor.getModel()!.getAllDecorations().filter(x => collection.has(x))) {
        let actualRange = expandRange(decoration.range, decoration.options.isWholeLine ?? false);
        edits.push({ range: actualRange, text: "" });

        let text = editor.getModel()!.getValueInRange(actualRange);
        const lineCount = decoration.range.endLineNumber - decoration.range.startLineNumber + 1;
        let textZone = new TextZone(decoration.range.startLineNumber - 1, lineCount);
        createEditor(text.split("\n"), textZone);
        viewzones.push(textZone);
    }

    return [edits, viewzones]
}

export function readdViewzonesAndTransitionOut(editor: monaco.editor.IStandaloneCodeEditor, viewZones: TextZone[], edits: monaco.editor.IIdentifiedSingleEditOperation[]) {
    for (let viewZone of viewZones) {
        viewZone.afterLineNumber = postEditPosition(viewZone.afterLineNumber + 1, edits) - 1;
    }

    editor.changeViewZones(accessor => {
        for (let x of viewZones) {
            x._id = accessor.addZone(x);
        }
    });
    transitionOutViewzones(editor, viewZones);
}
