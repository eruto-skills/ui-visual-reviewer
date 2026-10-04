# ui-visual-reviewer

> Claude Code skill — Web app UI color audit via real browser rendering

Web アプリ・PWA の UI カラーを実描画色で監査するスキル。`getComputedStyle` で実際にブラウザが描画した色を取得し、WCAG コントラスト比を計算してデザイントークンと照合する。

## What it does

- スクリーンショット目視より正確な色監査
- opacity stacking や CSS 変数解決後の実描画色を捕捉
- WCAG AA/AAA コントラスト比の自動計算
- デザイントークンとの差分検出

## Installation

```
/plugin install ui-visual-reviewer@eruto-skills
```

## Usage

このスキルは `design-deai` と補完関係にあります。`design-deai` でソースコードのパターン検出 → `ui-visual-reviewer` で実描画の視覚確認という順で使います。

## License

MIT

## Codex / Claude Code installation

This package supports both Codex and Claude Code. The plugin entry point is
`skills/ui-visual-reviewer/SKILL.md`; the root `SKILL.md` remains the standalone source.

For Codex, add the public `eruto-skills` marketplace in the plugin UI using
`https://github.com/eruto-skills/marketplace`, then install `ui-visual-reviewer`.
To install as a standalone user skill instead:

```bash
mkdir -p ~/.agents/skills
git clone https://github.com/eruto-skills/ui-visual-reviewer.git ~/.agents/skills/ui-visual-reviewer
```

On Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE/.agents/skills" | Out-Null
git clone https://github.com/eruto-skills/ui-visual-reviewer.git "$env:USERPROFILE/.agents/skills/ui-visual-reviewer"
```

In Codex, select the installed skill by name or invoke `$ui-visual-reviewer` with a task.
In Claude Code:

```text
/plugin marketplace add eruto-skills/marketplace
/plugin install ui-visual-reviewer@eruto-skills
```

The instructions use the tools available in the current host. Scripts are resolved
from the actual skill directory, rather than a fixed author path. Additional browser,
Python, or format-specific dependencies are described in `SKILL.md` and the references;
installing the plugin alone does not install those external programs.

## Maintaining the plugin package

Edit the root `SKILL.md` and its supporting resources, then run:

```bash
node scripts/package-plugin.mjs
node scripts/package-plugin.mjs --check
```

Commit the generated `skills/` files with the source changes. CI checks that both
layouts match, including the Claude manifest. Do not edit generated files directly.
