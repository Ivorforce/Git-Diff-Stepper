import { TextZone, postEditPosition, transitionOutViewzones } from "./ViewZones";
import Patch, { PatchDirection } from "../util/Patches";
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

export function removeDecorationsMatching(editor: monaco.editor.IStandaloneCodeEditor, match: (options: monaco.editor.IModelDecoration) => boolean) {
    editor.removeDecorations(editor.getModel()!.getAllDecorations()
        .filter(match)
        .map(x => x.id))
}

export function transitionInDecorations(editor: monaco.editor.IStandaloneCodeEditor, decorations: monaco.editor.IModelDeltaDecoration[], collection: monaco.editor.IEditorDecorationsCollection) {
    if (decorations.length == 0) {
        return;
    }

    // Remove fadeOuts before we fade in
    removeDecorationsMatching(editor, x => (x.options.className?.includes("fadeOut") ?? false) && decorations.some(y => x.range.intersectRanges(y.range)));

    const fadeInDecorations: monaco.editor.IModelDeltaDecoration[] = decorations.map(x => {
        return {
            range: x.range,
            options: { ...x.options, className: (x.options.className ?? "") + " fadeIn" },
        }
    });

    const fadeInDecorationIds = collection.set(fadeInDecorations);

    // TODO Adjustable time; requires css tho
    setTimeout(() => {
        // Check if we're still fading in
        if (!fadeInDecorationIds.every(x => editor.getModel()?.getDecorationOptions(x))) {
            return;
        }

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
                options: { ...x.options, className: (x.options.className ?? "").replace("fadeIn", "") + " fadeOut" },
            }
        });

    // Remove fadeIns before we fade out
    removeDecorationsMatching(editor, x => (x.options.className?.includes("fadeIn") ?? false) && collection.getRanges().some(y => x.range.intersectRanges(y)));

    // Let's create a new one so the old one is still accessible / can be re-filled.
    let newCollection = editor.createDecorationsCollection();
    newCollection.set(mappedDecorations);
    collection.clear();

    // TODO Adjustable time; requires css tho
    setTimeout(() => newCollection.clear(), 500);
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
        let textZone = new TextZone(decoration.range.startLineNumber - 1, lineCount, text, {
            ...decoration.options,
            className: (decoration.options.className ?? "").replace("fadeIn", "")
        });
        createEditor(textZone);
        viewzones.push(textZone);
    }

    return [edits, viewzones]
}

export function insertViewzonesPostEdit(editor: monaco.editor.IStandaloneCodeEditor, viewZones: TextZone[], edits: monaco.editor.IIdentifiedSingleEditOperation[]) {
    for (let viewZone of viewZones) {
        viewZone.afterLineNumber = postEditPosition(viewZone.afterLineNumber + 1, edits) - 1;
    }

    editor.changeViewZones(accessor => {
        for (let x of viewZones) {
            x._id = accessor.addZone(x);
        }
    });
}
