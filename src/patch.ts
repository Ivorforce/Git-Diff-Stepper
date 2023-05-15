// Note: Idxs start at 1
export const diffHeaderRegexInline = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export default class Patch {
    // Starts at 1.
    public oldFilePos: number;
    public delCount: number;

    // Starts at 1.
    public newFilePos: number;
    public addCount: number;

    public removedLines: string[];
    public addedLines: string[];

    constructor(oldFilePos: number, delCount: number, newFilePos: number, addCount: number, removedLines: string[], addedLines: string[]) {
        this.oldFilePos = oldFilePos;
        this.delCount = delCount;

        this.newFilePos = newFilePos;
        this.addCount = addCount;

        this.removedLines = removedLines;
        this.addedLines = addedLines;
    }
}

/// Note: Assumes 0 lines of context.
export function parsePatches(diff: string) : Patch[] {
    let lines = diff.split("\n");

    let patches: Patch[] = [];

    for (let i = 0; i < lines.length; i++) {
        let infoResult = diffHeaderRegexInline.exec(lines[i]);
        if (!infoResult) {
            continue;
        }

        let oldFilePos = Number(infoResult[1]);
        let delCount = infoResult[2] ? Number(infoResult[2]) : 1;
        if (delCount === 0) {
            // See https://man7.org/linux/man-pages/man1/diff.1p.html#:~:text=If%20a%20range%20is%20empty,empty%20range%20starts%20the%20file
            // If delCount == 0, the range indicates the previous line. Unless it starts the file, in which case it's 0.
            oldFilePos = oldFilePos + 1;
        }

        let newFilePos = Number(infoResult[3]);
        let addCount = infoResult[4] ? Number(infoResult[4]) : 1;

        let diffPatchDelStart = i + 1;
        let diffPatchAddStart = diffPatchDelStart + delCount;
        // TODO Should probably be eol sensitive...
        let addedLines = lines.slice(diffPatchAddStart, diffPatchAddStart + addCount).map(x => x.slice(1));
        let removedLines = lines.slice(diffPatchDelStart, diffPatchDelStart + delCount).map(x => x.slice(1));

        console.log(infoResult);
        console.log(infoResult[1]);
        console.log(oldFilePos);
        patches.push({
            oldFilePos: oldFilePos,
            delCount: delCount,

            newFilePos: newFilePos,
            addCount: addCount,

            removedLines: removedLines,
            addedLines: addedLines,
        });
    }

    return patches;
}
