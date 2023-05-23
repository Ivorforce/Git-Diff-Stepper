import * as monaco from 'monaco-editor';
import { MonacoPatchController } from './MonacoPatchController';
import { invoke } from '@tauri-apps/api/tauri'
import { PatchDirection, parsePatches } from './Patches';
import { writeTextFile } from '@tauri-apps/api/fs';

export class FileInfo {
    file_path: string;
    commit_list: string[];
}

export class MonacoLogController {
    patchController: MonacoPatchController;

    filePath: string;
    commitList: string[];

    currentVersion: string;
    nextVersion?: string;

    lastUpdate: number = 0;
    
    constructor(editor: monaco.editor.IStandaloneCodeEditor, createEditor: Function) {
        this.patchController = new MonacoPatchController(editor, createEditor);
    }

    async setNextVersion(nextVersion: string, direction: PatchDirection) {
        this.nextVersion = nextVersion;
        
        let before_version = direction == PatchDirection.Forwards ? this.currentVersion : nextVersion;
        let after_version = direction == PatchDirection.Forwards ? nextVersion : this.currentVersion;

        const diff = await invoke('git_diff', { file_path: this.filePath, before_version: before_version, after_version: after_version }) as string;
        const patches = parsePatches(diff);

		await this.patchController.setPatches(patches, direction);
    }

    async move(direction: PatchDirection) {
        if (!this.commitList) {
            return;
        }

        // TODO This is a failsafe because if it runs too fast we sometimes get errors.
        if (Date.now() < this.lastUpdate + 100) {
            return
        }
        this.lastUpdate = Date.now()

        if (this.nextVersion) {
            // We have a version planned! Let's apply or discard it.
            if (this.patchController.currentPatchDirection == direction) {
                await this.patchController.swapPatchFront();
                this.patchController.discardPatches();

                this.currentVersion = this.nextVersion;
                this.nextVersion = undefined;
            }
            else {
                this.patchController.discardPatches();
                this.nextVersion = undefined;
            }

            return;
        }
        else {
            const expectedVersion = await invoke('git_show', { file_path: this.filePath, version: this.currentVersion }) as string;
            if (this.patchController.editor.getValue() !== expectedVersion) {
                // Spend a step fixing the text first.
                this.patchController.setContents(expectedVersion);   // FIXME
                return
            }
    
            // We're blank! Let's transition to whereever we want to go.
            const currentVersionIdx = this.commitList.indexOf(this.currentVersion);
            const add = direction == PatchDirection.Forwards ? 1 : -1;
            const nextVersionIdx = currentVersionIdx + add;

            if (nextVersionIdx >= 0 && nextVersionIdx < this.commitList.length) {
                await this.setNextVersion(this.commitList[nextVersionIdx], direction);
            }
        }
    }

    async next() {
        this.move(PatchDirection.Forwards);
    }

    async prev() {
        this.move(PatchDirection.Backwards);  
    }

    async setFile(fileInfo: FileInfo) {
        this.filePath = fileInfo.file_path;
        this.commitList = fileInfo.commit_list;
        this.currentVersion = fileInfo.commit_list[0];

        const text = await invoke('git_show', { file_path: this.filePath, version: this.currentVersion }) as string;
        const model = monaco.editor.createModel(text, undefined, monaco.Uri.file(this.filePath));

        this.patchController.editor.setModel(model);
        this.patchController.setContents(text);
    }

    async saveFile() {
        let editor = this.patchController.editor;
        writeTextFile(editor.getModel()!.uri.fsPath, editor.getModel()?.getValue()!);
    }
}
