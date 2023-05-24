import { BaseDirectory, createDir, readDir, readTextFile } from '@tauri-apps/api/fs';
import * as monaco from 'monaco-editor';

export interface IVSCodeTheme {
    "$schema": "vscode://schemas/color-theme",
    "type": 'dark' | 'light',
    colors: { [name: string]: string };
    tokenColors: {
        name?: string;
        "scope": string[] | string,
        "settings": {
            foreground?: string;
            background?: string;
            fontStyle?: string;
        }
    }[]
}

export type IMonacoThemeRule = monaco.editor.ITokenThemeRule[]

// copied from here https://github.com/Nishkalkashyap/monaco-vscode-textmate-theme-converter
// running it from there apparently doesn't work. No idea why; probably because it includes a bunch of other libraries that
// aren't tauri compatible.
export function convert(theme: IVSCodeTheme): monaco.editor.IStandaloneThemeData {
    const monacoThemeRule: IMonacoThemeRule = [];
    const returnTheme: monaco.editor.IStandaloneThemeData = {
        inherit: false,
        base: 'vs-dark',
        colors: theme.colors,
        rules: monacoThemeRule,
        encodedTokensColors: []
    };

    theme.tokenColors.map((color) => {
        if (typeof color.scope == 'string') {

            const split = color.scope.split(',');

            if (split.length > 1) {
                color.scope = split;
                evalAsArray();
                return;
            }

            monacoThemeRule.push(Object.assign({}, color.settings, {
                // token: color.scope.replace(/\s/g, '')
                token: color.scope
            }));
            return;
        }

        evalAsArray();

        function evalAsArray() {
            if (color.scope) {
                (color.scope as string[]).map((scope) => {
                    monacoThemeRule.push(Object.assign({}, color.settings, {
                        token: scope
                    }));
                });
            }
        }
    });

    return returnTheme;
}

export async function load(): Promise<string[]> {
    await createDir("themes", { dir: BaseDirectory.AppData, recursive: true });
    var entries = await readDir("themes", { dir: BaseDirectory.AppData });
    entries.push(...await readDir("themes", { dir: BaseDirectory.Resource }));

    let addedThemes: string[] = [];
    for (const entry of entries) {
        if (!entry.name?.endsWith(".json")) {
            console.log(`Did not read theme (unknown suffix): ${entry.name}`)
            continue;
        }

        const text = await readTextFile(entry.path);
        const parsed: IVSCodeTheme = JSON.parse(text);
        const converted = convert(parsed);

        const themeID = entry.name.substring(0, entry.name.length - 5);
        monaco.editor.defineTheme(themeID, converted);
        addedThemes.push(themeID);
    }

    return addedThemes;
}

export function addSetThemeActions(editor: monaco.editor.IStandaloneCodeEditor, themes: string[], callback?: (theme: string, editor: monaco.editor.ICodeEditor) => void) {
    for (let themeID of themes) {
        editor.addAction({
            id: `setTheme-${themeID}`,
            label: `Set theme to ${themeID}`,
            run: (editor: monaco.editor.ICodeEditor, arg: string) => {
                monaco.editor.setTheme(themeID);
                callback?.(themeID, editor);
            }
        });
    }
}

export function getBackgroundColor(editor: monaco.editor.ICodeEditor): string {
    return getComputedStyle(editor.getDomNode()!)
        .getPropertyValue('--vscode-editor-background')
}
