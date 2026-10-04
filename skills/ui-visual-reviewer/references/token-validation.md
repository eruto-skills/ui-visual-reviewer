# Token Validation

デザイントークン定義から監査用マップを作る方法。

## light-dark() 形式のトークン（StyleX / countstack）

`src/tokens/colors.stylex.ts` のような形式：

```typescript
export const colors = stylex.defineVars({
  surfaceHigh: 'light-dark(#EAE7F0, #262830)',
  textPrimary: 'light-dark(#1B1B1F, #E3E2E6)',
  counterWarning: 'light-dark(#7D5700, #FFD149)',
  // ...
});
```

→ 抽出ルール：`light-dark(<light>, <dark>)` の第1引数が `light` モード値、第2引数が `dark` モード値。

→ マップ化：

```javascript
const TOKENS = {
  light: {
    '#eae7f0': 'surfaceHigh',
    '#1b1b1f': 'textPrimary / counterNormal',
    '#7d5700': 'counterWarning',
  },
  dark: {
    '#262830': 'surfaceHigh',
    '#e3e2e6': 'textPrimary / counterNormal',
    '#ffd149': 'counterWarning',
  },
};
```

**注意：** hex はすべて小文字で統一する（`getComputedStyle` が返す値と照合するため）。

## CSS Custom Properties 形式（Tailwind / CSS変数）

```css
:root {
  --color-surface: #F5F5F5;
  --color-text: #1A1A1A;
}
[data-theme="dark"] {
  --color-surface: #1A1A1A;
  --color-text: #F5F5F5;
}
```

→ `getComputedStyle(el).getPropertyValue('--color-surface')` で現在の解決済み値を取得可能。

## W3C DTCG 形式（Dembrandt CLI 出力）

```json
{
  "color": {
    "surface": { "$value": "#262830", "$type": "color" },
    "text-primary": { "$value": "#E3E2E6", "$type": "color" }
  }
}
```

→ フラット化してマップに変換。

## 近似マッチの閾値

RGB空間での距離²：

| 閾値 | 意味 | 推奨 |
|-----|------|------|
| 0 | 完全一致のみ | 厳格すぎる（ブラウザが丸める場合がある） |
| < 100 | ほぼ同色 | 安全 |
| < 400 | ΔE ≈ 3（人間の閾値付近） | デフォルト推奨 |
| < 1000 | やや違う色でも近似扱い | 緩すぎる |

```javascript
// 距離² < 400 を「近似マッチ」とする
const d = (rgb.r - t.r)**2 + (rgb.g - t.g)**2 + (rgb.b - t.b)**2;
if (d < 400) return { hex: tokenHex, token: name, distance: d };
```
