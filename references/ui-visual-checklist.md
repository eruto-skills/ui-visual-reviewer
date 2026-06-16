# UI Visual Checklist

`ui-visual-reviewer` スキルで監査する観点。

## コントラスト（WCAG 2.2 SC 1.4.3 / 1.4.11）

**四捨五入しない**（4.49:1 は不合格）。

| テキスト種別 | AA 最低値 | AAA 目標値 |
|------------|---------|---------|
| 通常テキスト（< 18pt / 太字 < 14pt） | 4.5:1 | 7:1 |
| 大きいテキスト（≥ 18pt、または太字 ≥ 14pt） | 3:1 | 4.5:1 |
| 意味を持つ UI コンポーネント境界 | 3:1 | — |

- [ ] すべてのテキスト要素が AA を満たしているか
- [ ] Opacity stacking 後の実効コントラストが AA を満たしているか
- [ ] disabled/inactive 状態のテキストは WCAG 適用外だが、読みにくすぎないか

## Opacity Stacking（opacity重ねがけ）

- [ ] `opacityStack < 1.0` の要素を確認 → 意図的なstackingか意図外か
- [ ] inactive card (`opacity: 0.5`) など設計上のstacking → トークン設計としてアーカイブ
- [ ] アニメーション中間状態の偽陽性 → スクリーンショットで目視確認

## トークン照合

- [ ] `matchedToken: null` の要素 → トークン外の色が使われている
  - ハードコードされた hex ではないか
  - CSS変数の命名が間違っていないか
- [ ] 想定外のトークンが使われていないか（例: `onPrimary` が背景に使われている等）

## カウンター値の状態別確認（countstack固有）

- [ ] 初期状態 (value=0): `counterNormal` on `surfaceHigh`
- [ ] warning状態 (推奨値近辺): `counterWarning` on `warningContainer`
- [ ] max状態 (max超過): `counterMax` on `errorContainer`
- [ ] goal状態 (目標達成): `counterGoal` on （確認中）

## light-dark() テスト

- [ ] dark モードで監査 → `--scheme dark`
- [ ] light モードで監査 → `--scheme light`
- [ ] 両モードで AA を満たしているか（一方だけ通過するケースに注意）

## モーダル・ドロワー状態

- [ ] モーダル内のラベル（placeholder, hint text等）のコントラストを確認
- [ ] 例: 「直接入力」ラベル (`textDisabled`) on `surfaceMid` → 3.76:1（AA未達の実例）

## 目視確認が必要なケース

- `opacityStack < 0.5` の要素 → アニメーション中間状態の可能性大
- コントラスト < 1.5:1 の非disabled要素 → 偽陽性の可能性
- Canvas / SVG 要素 → スクリプトで取得不可、目視必須
