import { loadWASM } from 'onigasm' // peer dependency of 'monaco-textmate'
import { Registry } from 'monaco-textmate' // peer dependency
import { wireTmGrammars } from 'monaco-editor-textmate'
import * as monaco from 'monaco-editor';
import { resolveResource } from '@tauri-apps/api/path';
import { createDir, BaseDirectory, readDir, readTextFile, readBinaryFile } from '@tauri-apps/api/fs';


export async function setup() {
    await createDir("tmlanguages", { dir: BaseDirectory.AppData, recursive: true });
    const entries = await readDir("tmlanguages", { dir: BaseDirectory.AppData });

    // map of monaco "language id's" to TextMate scopeNames
    const grammars = new Map();
    var paths: { [id: string] : string } = {};

    for (const entry of entries) {
        if (!entry.name?.endsWith(".tmLanguage")) {
            console.log(`Did not read tmlanguage file (unknown suffix): ${entry.name}`)
            continue;
        }

        const languageID = entry.name!.substring(0, entry.name.length - 11);
        const scopeName = "source." + languageID;

        grammars.set(languageID, scopeName);
        paths[scopeName] = entry.path;

        monaco.languages.register({
            id: languageID,
            extensions: ["." + languageID]  // Best guess; the .tmLanguage files don't include this!
        });    
    }

    const contents = await readBinaryFile("onigasm.wasm", { dir: BaseDirectory.Resource });
    await loadWASM(contents.buffer) // See https://www.npmjs.com/package/onigasm#light-it-up

    const registry = new Registry({
        getGrammarDefinition: async (scopeName) => {
            return {
                format: "plist",
                content: await readTextFile(paths[scopeName])
            };
        }
    });

    wireTmGrammars(monaco, registry, grammars)
}
