import * as monaco from 'monaco-editor';
import Patch, { PatchDirection, swapPatchDirection } from './Patches';
import { TextZone, destroyViewzones, gatherViewzones, insertInterspersedText, insertDecorationsPostEdit, transitionInViewzones, transitionOutViewzones } from './ViewZones';
import { deleteDecoratedText, gatherDecorations, insertViewzonesPostEdit, transitionInDecorations, transitionOutDecorations } from './Decorations';


function clearUndoRedoStack(editor: monaco.editor.ICodeEditor) {
    let model = editor.getModel()!;
    (model as any)._undoRedoService._editStacks.get(model.uri.toString())._past = [];
}

export class MonacoPatchController {
    public editor: monaco.editor.IStandaloneCodeEditor;
    public createEditor: Function;

    public currentPatches: Patch[] = [];
    public currentPatchDirection: PatchDirection = PatchDirection.Forwards;

    private viewZones: TextZone[] = [];
    private decorations: monaco.editor.IEditorDecorationsCollection;

    public constructor(editor: monaco.editor.IStandaloneCodeEditor, createEditor: Function) {
        this.editor = editor;
        this.createEditor = createEditor;
        this.decorations = editor.createDecorationsCollection();

        editor.onDidChangeCursorSelection((event) => this.selectEditor(editor, event));
    }

    setContents(contents: string) {
        destroyViewzones(this.editor, this.viewZones);
        this.viewZones = [];
        this.decorations.clear();
        this.editor!.getModel()!.setValue(contents);
    }

    setPatches(patches: Patch[], direction: PatchDirection) {
        this.discardPatches();

        this.currentPatches = patches;
        this.currentPatchDirection = direction;

        if (patches.length == 0) {
            return;
        }

        let decorationClassName = direction == PatchDirection.Forwards ? 'deleteCode' : 'addCode';
        let viewZoneClassName = direction == PatchDirection.Forwards ? 'addCode' : 'deleteCode';

        let decorations = gatherDecorations(patches, direction, {
            isWholeLine: true,
            className: decorationClassName,
            // TODO Don't use because we don't have view zone rulers yet
            // overviewRuler: { color: "red", position: monaco.editor.OverviewRulerLane.Center }
        });
        transitionInDecorations(this.editor!, decorations, this.decorations);

        this.viewZones = gatherViewzones(patches, direction, (textZone: TextZone) => this.createEditor(this.editor.getModel()?.getLanguageId(), textZone), {
            isWholeLine: true,
            className: viewZoneClassName,
        });
        this.viewZones.forEach(viewZone => viewZone.editorPromise.then(editor => editor.onDidChangeCursorSelection((event) => this.selectEditor(editor, event))));
        transitionInViewzones(this.editor!, this.viewZones);
    }

    selectEditor(editor: monaco.editor.IStandaloneCodeEditor, event: monaco.editor.ICursorSelectionChangedEvent) {
        if (event.source === "PatchController") {
            return;
        }

        for (let otherEditor of [...this.viewZones.map(x => x.editor), this.editor]) {
            if (editor !== otherEditor) {
                otherEditor?.setSelection(new monaco.Selection(0, 0, 0, 0), "PatchController");
            }
        }
    }

    discardPatches() {
        if (this.currentPatches.length == 0) {
            return
        }

        transitionOutViewzones(this.editor!, this.viewZones);
        this.viewZones = [];
        transitionOutDecorations(this.editor!, this.decorations);

        this.currentPatches = [];
    }

    async swapPatchFront() {
        if (this.currentPatches.length === 0) {
            return;
        }

        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];

        let [deleteEdits, deleteViewZones] = deleteDecoratedText(this.editor, (textZone: TextZone) => this.createEditor(this.editor.getModel()?.getLanguageId(), textZone), this.decorations);
        edits.push(...deleteEdits);

        // Nothing happened yet... Let's wait for the text editors to launch.
        for (let viewZone of deleteViewZones) {
            await viewZone.editorPromise;
        }

        let addEdits = insertInterspersedText(this.editor, this.viewZones);
        edits.push(...addEdits);

        this.editor!.executeEdits(null, edits);
        this.editor.pushUndoStop();
        clearUndoRedoStack(this.editor!);

        insertDecorationsPostEdit(this.decorations, this.viewZones, edits);
        insertViewzonesPostEdit(this.editor, deleteViewZones, edits);
        this.viewZones = deleteViewZones;

        this.currentPatchDirection = swapPatchDirection(this.currentPatchDirection);
    }
}