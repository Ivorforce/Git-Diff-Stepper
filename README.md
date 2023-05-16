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

- When fixing text, add some kind of white flash to show that something happened.
- When TextZones spawn because of disappearing text, they flash black a bit.
- Language isn't guessed yet.
- Animations and style ought to be configurable.
- Language support ought to be configurable.
- The file ought to be saveable, for quick test iteration.
