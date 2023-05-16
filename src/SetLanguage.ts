import * as monaco from 'monaco-editor';

export function addSetLanguageActions(editor: monaco.editor.IStandaloneCodeEditor) {
    for (let language of monaco.languages.getLanguages()) {
        editor.addAction({
            id: `setLanguage-${language.id}`,
            label: `Set language to ${language.id}`,
            run: (editor: monaco.editor.ICodeEditor, arg: string) => {
                monaco.editor.setModelLanguage(editor.getModel()!, language.id);
            }
        });    
    }
}