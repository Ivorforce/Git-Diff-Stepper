# Git Diff Stepper

An app that allows you to animate through the `git log` iterations of a file.

It is technically a continuation of [VSCode Git Diff Stepper](https://github.com/Ivorforce/VSCode-Git-Diff-Stepper): VSCode doesn't expose a way to create editors in insets, and that [won't change in the near future](https://github.com/microsoft/vscode/issues/153198). Other projects embed instances of Monaco and try to fit the style; at this point I decided I might as well create a standalone app which may make animations easier too.

## Controls

- Select a file using File -> Open
- `cmd / ctrl` + `left` or `right` arrow keys move through iterations.

## Setup

- Install Rust, pnpm
- `pnpm install`
- `pnpm tauri dev`

## Roadmap

- Disappearing view zones don't spawn fadeout decorations (because their positions are invalidated during the edit).
- Wait on new view zones to be created before starting transitions to avoid flash of loading indicators.
- If the file changed before loadign a patch, revert file as an extra transition.
