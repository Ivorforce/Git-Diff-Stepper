import { BaseDirectory, readTextFile } from '@tauri-apps/api/fs';
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
export function convertTheme(theme: IVSCodeTheme): monaco.editor.IStandaloneThemeData {
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

export async function loadThemes() {
    const vs_dark_plus = await readTextFile("themes/vs-dark-plus.json", { dir: BaseDirectory.Resource });
    const parsed: IVSCodeTheme = JSON.parse(vs_dark_plus);
    const converted = convertTheme(parsed);
    monaco.editor.defineTheme('vs-dark-plus', converted);
}
