---
name: ui-visual-reviewer
description: >
  Webアプリ・PWAのUIカラーを実描画色で監査する。getComputedStyleで実際にブラウザが描画した色を取得し、
  WCAGコントラスト比を計算してデザイントークンと照合する。スクリーンショット目視レビューより正確で、
  opacity stackingやCSS変数解決後の色も捕捉できる。
user-invocable: false
allowed-tools: Read, Bash, Glob, Grep, Write
---

# ui-visual-reviewer

アプリUIのカラーを実描画色で監査するスキル。`slide-visual-reviewer` のUI版。

## 前提知識：なぜ目視レビューでは不十分か

| 手法 | 取れる情報 | 欠点 |
|------|-----------|------|
| ソースコード / トークン確認 | 設計意図の色 | `light-dark()` / CSS変数解決後・`opacity` 重ねがけを無視 |
| `getComputedStyle()` | CSSレイヤーの色（変数・light-dark解決済み） | 親要素の `opacity` stacking を自動では反映しない |
| スクリーンショット目視 | 見た目の判断 | コントラスト比を数値で出せない・代表的な状態を撮れていないと見逃す |
| **このスキルの手法** | DOM walking + getComputedStyle + opacity stack計算 | アニメーション中間状態やCanvas描画は捕捉できない（制限事項参照） |

**主な改善点：**

- `getComputedStyle(el).color` / `backgroundColor` → `light-dark()`・CSS変数を解決した実際の `rgb()` を返す
- DOMツリー上位方向にwalkして `opacity` の積算を計算 → MemberCardの `opacity: 0.5` のようなstackingを検出
- 実際の `rgb()` をトークン定義のhex値と照合 → 「設計意図の色」と「実描画色」の乖離を検出
- WCAG コントラスト比をインラインで計算 → AA/AAAの合否を自動判定

## Workflow

### Step 1: 対象アプリのデザイントークンを読む

`tokens/colors.*.ts` または同等のファイルを読み、ダーク/ライトモードの色定義を把握する。
`light-dark()` 形式の場合は両モードの値を抽出する。

→ [token-validation.md](references/token-validation.md)

### Step 2: アプリ固有のナビゲーションスクリプトを確認・作成

Puppeteer を使い、監査したい画面まで到達するスクリプトが必要。
既存スクリプトがあればそれを使用。なければ [extract-colors.cjs](scripts/extract-colors.cjs) のテンプレートをベースに作成する。

必要な処理：
1. dev server に接続（ポート確認）
2. アプリ固有のセットアップ（IndexedDB seeding、プロファイル作成等）
3. 監査対象画面への遷移
4. 必要な状態への誘導（カウンター値の設定等）

### Step 3: カラー監査を実行

```bash
node scripts/visual-audit.cjs --url http://localhost:<port> --scheme dark
node scripts/visual-audit.cjs --url http://localhost:<port> --scheme light
```

出力：
- `screenshots/audit-<scheme>-initial.png` — 初期状態スクリーンショット
- `screenshots/audit-<scheme>-report.json` — 全要素のカラーデータ・コントラスト比
- コンソールサマリー

### Step 4: 結果の評価

コンソール出力を確認し、以下を評価する：

1. **コントラスト FAIL** — WCAG AA 不合格（本文 4.5:1 未満、大文字 3:1 未満）
2. **Opacity stacking** — opacity < 1.0 の祖先を持つ要素。実効コントラストが宣言値より低い
3. **トークン不一致** — `matchedToken: null` の要素。意図外の色が使われている可能性
4. **偽陽性の確認** — `opacity×0.38` のような極端な値はアニメーション中間状態の可能性 → スクリーンショットと照合

→ [ui-visual-checklist.md](references/ui-visual-checklist.md) で評価観点を確認

### Step 5: 問題があれば修正提案

- WCAG 違反 → 代替トークンの提案（コントラスト比を計算してから）
- Opacity stacking → 意図的か否かを確認。MemberCard の inactive状態など設計意図のstackingは容認
- トークン不一致 → 実装がトークンを正しく使っているか確認

### Step 6: 複数の状態でテスト

countstackの例：
- 初期状態（value=0）→ counterNormal色
- warning状態（推奨値近辺） → counterWarning色
- max状態 → counterMax色

状態変化のたびに `getComputedStyle` で色が変わっていることを確認する。

## ブラウザ側カラー抽出パターン

以下のパターンが中心。プロジェクトの `scripts/` に置く Puppeteer スクリプトに埋め込む。

```javascript
// Puppeteer の page.evaluate() に文字列として渡す IIFE
const BROWSER_AUDIT_FN = `
(function auditPage() {
  function parseRgba(s) {
    const m = s.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
  }

  function blend(src, dst) {
    const a = src.a;
    return { r: Math.round(src.r*a + dst.r*(1-a)), g: Math.round(src.g*a + dst.g*(1-a)), b: Math.round(src.b*a + dst.b*(1-a)), a: 1 };
  }

  // el自身から上位方向にwalkして実効背景色とopacity積算を取得
  // el自身を含める（ボタンの場合、el自身がbackground-colorを持つため）
  function resolveBackground(el) {
    let opacityStack = 1;
    let bgStack = null;
    let cur = el;
    while (cur && cur !== document.documentElement) {
      const style = window.getComputedStyle(cur);
      const op = parseFloat(style.opacity);
      if (!isNaN(op) && op < 1) opacityStack *= op;
      const bg = parseRgba(style.backgroundColor);
      if (bg && bg.a > 0) {
        bgStack = bgStack ? blend(bg, bgStack) : bg;
        if (bg.a >= 1) break;
      }
      cur = cur.parentElement;
    }
    if (!bgStack) {
      const scheme = document.documentElement.style.colorScheme || '';
      bgStack = scheme.includes('light') ? {r:255,g:255,b:255,a:1} : {r:17,g:19,b:24,a:1};
    }
    return { effectiveBg: bgStack, opacityStack };
  }

  // isCounterValue: font-variant shorthand と longhand の両方をチェック
  // （StyleX は fontVariant:['tabular-nums'] を shorthand にコンパイルするため）
  function isCounterValue(el, style) {
    const text = el.textContent.trim();
    const fv = style.fontVariant || style.fontVariantNumeric ||
               style.getPropertyValue('font-variant-numeric') || '';
    return /^-?\\d+$/.test(text) && parseFloat(style.fontSize) >= 12 && fv.includes('tabular-nums');
  }

  const results = [], seen = new Set();
  for (const el of document.querySelectorAll('*')) {
    if (!el.textContent?.trim()) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (el.querySelectorAll('*').length > 8) continue;  // コンテナを除外
    const key = el.tagName + '|' + Math.round(rect.x) + '|' + Math.round(rect.y);
    if (seen.has(key)) continue;
    seen.add(key);
    const fgColor = parseRgba(style.color);
    if (!fgColor) continue;
    const { effectiveBg, opacityStack } = resolveBackground(el);
    const eFg = opacityStack >= 1 ? fgColor : blend({...fgColor, a: opacityStack}, effectiveBg);
    const fontSize = parseFloat(style.fontSize);
    results.push({
      tag: el.tagName.toLowerCase(), text: el.textContent.trim().slice(0, 40),
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      fg: fgColor, effectiveFg: eFg, bg: effectiveBg,
      opacityStack: Math.round(opacityStack * 100) / 100,
      fontSize: Math.round(fontSize), fontWeight: parseFloat(style.fontWeight) || 400,
      isLargeText: fontSize >= 24 || (fontSize >= 18.67 && (parseFloat(style.fontWeight)||400) >= 700),
      isCounterValue: isCounterValue(el, style),
    });
  }
  return results;
})()
`;

// 使用例
const elements = await page.evaluate(BROWSER_AUDIT_FN.trim());
```

## WCAG コントラスト比の計算

```javascript
function sRGBToLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function relativeLuminance({ r, g, b }) {
  return 0.2126 * sRGBToLinear(r) + 0.7152 * sRGBToLinear(g) + 0.0722 * sRGBToLinear(b);
}
function contrastRatio(fg, bg) {
  const l1 = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const l2 = Math.min(relativeLuminance(fg), relativeLuminance(bg));
  return (l1 + 0.05) / (l2 + 0.05);
}
// WCAG AA: 通常テキスト ≥ 4.5:1、大きいテキスト(≥18pt or 太字≥14pt) ≥ 3:1
// WCAG AAA: 通常テキスト ≥ 7:1、大きいテキスト ≥ 4.5:1
```

## トークン照合

```javascript
// プロジェクトの colors.stylex.ts 等から dark/light 両モードの hex を抽出してマップ化
const TOKENS = {
  dark: {
    '#262830': 'surfaceHigh',
    '#e3e2e6': 'textPrimary / counterNormal',
    '#ffd149': 'counterWarning',
    // ...
  },
};

function matchToken(rgb, scheme) {
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  const map = TOKENS[scheme];
  if (map[hex]) return { hex, token: map[hex], distance: 0 };
  // 近似マッチ（距離² < 400 ≈ ΔE ~3）
  let best = null, bestDist = Infinity;
  for (const [tokenHex, name] of Object.entries(map)) {
    const t = hexToRgb(tokenHex);
    const d = (rgb.r-t.r)**2 + (rgb.g-t.g)**2 + (rgb.b-t.b)**2;
    if (d < bestDist) { bestDist = d; best = { hex: tokenHex, token: name, distance: d }; }
  }
  return best?.distance < 400 ? best : { hex, token: null, distance: bestDist };
}
```

## 制限事項と既知の偽陽性

→ [false-positive-guide.md](references/false-positive-guide.md)

主なもの：
1. **Canvas / WebGL 描画** — `getComputedStyle` はDOM要素のCSSのみ。Canvas内の描画色は取得不可
2. **アニメーション中間状態** — スクリプト実行タイミングによりopacity transitionの中間値を取ることがある
   - 症状: `opacity×0.38` のような中途半端な値
   - 確認: スクリーンショットと目視照合する
3. **プレス状態オーバーレイ** — React Native Web の `Pressable` はプレス後にopacityオーバーレイを残すことがある
   - 症状: ボタン文字列のコントラストが極端に低い（1.0〜1.5:1）
   - 確認: 手動でボタンを見て実際に読めるかチェック
4. **SVG 塗り色** — `fill` 属性はCSSの `color` / `backgroundColor` ではないため取得不可
5. **Pseudo-elements** — `::before` / `::after` の色は `getComputedStyle(el, '::before')` で別途取得が必要

## countstackでの実績（参考）

- 検証日: 2026-06-15
- スクリプト: `c:\@projects\countstack\scripts\visual-audit.cjs`
- 主な発見:
  - counterNormal (`#E3E2E6`) on surfaceHigh (`#262830`) = **11.4:1 ✓** （ad-hocレビューでの指摘①は誤りだった）
  - モーダル「直接入力」ラベル (`textDisabled #74777f`) on surfaceMid (`#1B1D24`) = **3.76:1 ✗** (WCAG AA未達)
  - 「メンバー追加」ボタン = 偽陽性の疑い（プレス状態オーバーレイ）→ 要手動確認

## Cross-Skill Integration

- **← countstack `/audit-gap`**: 実装ギャップ検出の後、色の実描画確認にこのスキルを使う
- **← countstack `ux-audit` agent**: UX監査のカラー検証フェーズで呼び出す
- **→ slide-visual-reviewer**: スライドのPNG目視確認はこちら（UIアプリとは別スキル）
