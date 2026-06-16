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
