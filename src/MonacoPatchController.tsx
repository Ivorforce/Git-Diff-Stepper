import * as monaco from 'monaco-editor';
import Patch, { PatchDirection } from './Patches';
import { TextZone, destroyViewzones, gatherViewzones, insertInterspersedText, readdDecorationsAndTransitionOut, transitionInViewzones, transitionOutViewzones } from './ViewZones';
import { deleteDecoratedText, gatherDecorations, readdViewzonesAndTransitionOut, transitionInDecorations, transitionOutDecorations } from './Decorations';


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
    }

    setContents(contents: string) {
        destroyViewzones(this.editor, this.viewZones);
        this.viewZones = [];
        this.decorations.clear();

        monaco.editor.setModelLanguage(this.editor!.getModel()!, "python");  // FIXME
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

        this.viewZones = gatherViewzones(patches, direction, (lines: string[], textZone: TextZone) => this.createEditor(lines, viewZoneClassName, textZone));
        transitionInViewzones(this.editor!, this.viewZones);
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

    applyPatches() {
        if (this.currentPatches.length === 0) {
            return;
        }

        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];

        let decorationClassName = this.currentPatchDirection == PatchDirection.Backwards ? 'deleteCode' : 'addCode';
        let viewZoneClassName = this.currentPatchDirection == PatchDirection.Backwards ? 'addCode' : 'deleteCode';

        let [deleteEdits, deleteViewZoneProtos] = deleteDecoratedText(this.editor, this.decorations);
        edits.push(...deleteEdits);
        this.decorations.clear();

        let addEdits = insertInterspersedText(this.editor, this.viewZones);
        edits.push(...addEdits);

        this.editor!.executeEdits(null, edits);

        readdDecorationsAndTransitionOut(this.decorations, this.viewZones, edits);
        readdViewzonesAndTransitionOut(this.editor, deleteViewZoneProtos, (lines: string[], textZone: TextZone) => this.createEditor(lines, viewZoneClassName, textZone), edits);
        this.viewZones = [];
    }
}