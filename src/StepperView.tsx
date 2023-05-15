import React from 'react';
import ReactDOM from 'react-dom';
import { renderToStaticMarkup } from "react-dom/server"
import { readTextFile } from '@tauri-apps/api/fs';

import * as monaco from 'monaco-editor';
import Editor, { Monaco } from '@monaco-editor/react';
import { useEffect } from 'react';
import { DiffView } from './DiffView';
import Patch, { parsePatches } from './patch';
import { invoke } from '@tauri-apps/api/tauri'

export class FileInfo {
    file_path: string;
    first_version_text: string;
    commit_list: string[];
}

export class StepperView extends React.Component {
    diffViewRef: React.RefObject<DiffView> = React.createRef();

    filePath: string;
    commitList: string[];

    currentVersion: string;
    nextVersion?: string;
    
    render() {
        const this_ = this;

        return <DiffView
            ref={this.diffViewRef}
            handleEditorDidMount={(editor, monaco) => {
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow, () => this_.prev());
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.RightArrow, () => this_.next());        
            }}
        />;
    }

    async setNextVersion(nextVersion: string) {
        this.nextVersion = nextVersion;
        const diff = await invoke('git_diff', { file_path: this.filePath, before_version: this.currentVersion, after_version: nextVersion }) as string;
        const patches = parsePatches(diff);

		this.diffViewRef.current?.setDiff(patches);
    }

    async next() {
        if (!this.commitList) {
            return;
        }

        if (this.nextVersion) {
            this.diffViewRef.current?.applyCurrentDiff();
            this.currentVersion = this.nextVersion;
            this.nextVersion = undefined;
            return;
        }
        else {
            // Find the next version to step to
            const currentVersionIdx = this.commitList.indexOf(this.currentVersion);
            if (currentVersionIdx + 1 < this.commitList.length) {
                this.setNextVersion(this.commitList[currentVersionIdx + 1]);
            }
        }        
    }

    async prev() {
        if (!this.commitList) {
            return;
        }

        console.log("Prev!")
    }

    setFile(fileInfo: FileInfo) {
        this.filePath = fileInfo.file_path;
        this.diffViewRef.current?.setContents(fileInfo.first_version_text);
        this.commitList = fileInfo.commit_list;
        this.currentVersion = fileInfo.commit_list[0];
    }
}
