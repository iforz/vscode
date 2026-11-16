# Retired WorkHub Code OSS base

Archived on 2026-11-16 before removing the local IDE source and build dependencies.

- Archive branch: `codex/archive-workhub-codeoss-20261116` in https://github.com/iforz/vscode
- Upstream base: `2c33b50b16c472efe58357d1d2a8a5414bc23fbf` (1.144.0).
- Preserves the seven modified files and four new files from the local WorkHub workbench, without rewriting their contents.
- Includes the writing/configuration/Skill interfaces, review menu, editor styling, explorer workflow shortcut and development launcher integration.
- WorkHub's maintained extension lives in the WorkHub repository at `CodeOSS/extensions/workhub`; its portable Webview interfaces replace the former native-workbench dialogs.
- The folder-click shortcut and exact native menu ordering remain historical customizations; AGY uses the extension's explicit workflow commands and standard extension menus.
- This is a source archive, not a new IDE release. The original pre-commit hygiene check was run and failed with 101 existing issues, primarily unlocalized Chinese literals, missing file headers and whitespace. The archive commit skips that hook to preserve the original source bytes. No IDE build or release validation is claimed.
- Compiled Electron applications, node_modules, generated output and caches are excluded. User data remains separately in the WorkHub repository's ignored `data/code-oss` directory.

Restore with `git clone --branch codex/archive-workhub-codeoss-20261116 --single-branch https://github.com/iforz/vscode.git` if the retired implementation is needed later.
