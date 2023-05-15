import * as monaco from 'monaco-editor';
import { MonacoPatchController } from './MonacoPatchController';
import { invoke } from '@tauri-apps/api/tauri'
import { PatchDirection, parsePatches } from './Patches';

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
    
    constructor(editor: monaco.editor.IStandaloneCodeEditor, createEditor: Function) {
        this.patchController = new MonacoPatchController(editor, createEditor);
    }

    async setNextVersion(nextVersion: string, direction: PatchDirection) {
        this.nextVersion = nextVersion;
        const diff = await invoke('git_diff', { file_path: this.filePath, before_version: this.currentVersion, after_version: nextVersion }) as string;
        const patches = parsePatches(diff);

		this.patchController.setPatches(patches, direction);
    }

    async move(direction: PatchDirection) {
        if (!this.commitList) {
            return;
        }

        if (this.nextVersion) {
            // We have a version planned! Let's apply or discard it.
            if (this.patchController.currentPatchDirection == direction) {
                this.patchController.applyPatches();
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
        this.patchController.setContents(text);
    }
}