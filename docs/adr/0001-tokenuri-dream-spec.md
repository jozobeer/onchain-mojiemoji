# ADR-0001: `tokenURI` の Dream 仕様と Stamp.text のオンチェーン格納

- 採択日: 2026-05-19
- ステータス: **Superseded by [ADR-0002](./0002-upgradeable-dictionary.md)**（2026-05-21）─ Stamp.text 入力経路 / `bytes32` inline storage / 文字種制約はすべて廃止。本文は歴史的記録として保持。
- 関係者: jozobeer

## Context（背景）

本プロダクトの Dream は以下：

> **`mojiemoji.jozo.beer` の URL = 画像というステートレス性を、`tokenURI` として ERC-721 に <img src="https://mojiemoji.jozo.beer/emoji/%E7%84%BC%E3%81%8D?font=gothic-bold&color=3b82f6&animation=kira&speed=normal&background=transparent&outline=darker&outline_width=2" alt="焼き" height="24" align="absmiddle"><img src="https://mojiemoji.jozo.beer/emoji/%E4%BB%98%E3%81%91?font=gothic-bold&color=3b82f6&animation=kira&speed=normal&background=transparent&outline=darker&outline_width=2" alt="付け" height="24" align="absmiddle">、URL（≒ 画像）を NFT として Ethereum 上に <img src="https://mojiemoji.jozo.beer/emoji/%E6%B0%B8%E7%B6%9A%E5%8C%96?font=maru-bold&color=34d399&animation=mochimochi&speed=slow&background=transparent&outline=darker&outline_width=2" alt="永続化" height="24" align="absmiddle"> する**

雛形（[`GeneralD/project-template-hardhat-erc721psi-upgradeable`](https://github.com/GeneralD/project-template-hardhat-erc721psi-upgradeable)）の `tokenURI` は

```
baseURI + keccak256(prefix + tokenId).hex + ".json"
```

を返す。これは「オフチェーンの JSON ファイル URL を返す汎用 ERC-721 メタデータ方式」で、画像は別途どこかにホスティングしている前提。**Dream の <img src="https://mojiemoji.jozo.beer/emoji/%E7%9C%9F%E9%80%86?font=dela&color=f59e0b&animation=poyoon&speed=normal&background=transparent&outline=darker&outline_width=2" alt="真逆" height="24" align="absmiddle">**。

このプロダクトは画像をどこにも保存せず、`mojiemoji.jozo.beer/?text=...` のような URL を `tokenURI` から直接返したい。さらに：

- **他 Param**（色 / アウトライン / アニメ / 速度）は `tokenId` のハッシュから決定論的に <img src="https://mojiemoji.jozo.beer/emoji/%E6%B4%BE%E7%94%9F?font=gothic-bold&color=ec4899&animation=bane&speed=normal&background=transparent&outline=darker&outline_width=2" alt="派生" height="24" align="absmiddle"> させ、最大 10 万バリエーションを目指す
- **文字列のみ**ユーザー入力なのでオンチェーンに記録する必要がある ─ これがガス代の問題

## Decision（決定）

### 1. `tokenURI(tokenId)` は <img src="https://mojiemoji.jozo.beer/emoji/%E5%8B%95%E7%9A%84?font=maru&color=60a5fa&animation=yurayura&speed=slow&background=transparent&outline=darker&outline_width=2" alt="動的" height="24" align="absmiddle"><img src="https://mojiemoji.jozo.beer/emoji/%E5%90%88%E6%88%90?font=maru&color=60a5fa&animation=yurayura&speed=slow&background=transparent&outline=darker&outline_width=2" alt="合成" height="24" align="absmiddle"> で mojiemoji URL を返す

返却形式：

```
https://mojiemoji.jozo.beer/?text=<percent-encoded UTF-8>[&...他 Param]
```

他 Param は `tokenId` のハッシュから <img src="https://mojiemoji.jozo.beer/emoji/%E6%B4%BE%E7%94%9F?font=gothic-bold&color=ec4899&animation=bane&speed=normal&background=transparent&outline=darker&outline_width=2" alt="派生" height="24" align="absmiddle">（**詳細は別 ADR で**）。

### 2. Stamp.text のストレージは `bytes32` inline

```solidity
mapping(uint256 => bytes32) private _stampText;
```

**Short String Optimization (SSO)** パターン。

- mint 時 SSTORE 1 回 = **約 20,000 gas で <img src="https://mojiemoji.jozo.beer/emoji/%E5%9B%BA%E5%AE%9A?font=mincho&color=8b5cf6&animation=nami&speed=slow&background=transparent&outline=darker&outline_width=2" alt="固定" height="24" align="absmiddle">**（文字数に依存しない）
- 1 slot <img src="https://mojiemoji.jozo.beer/emoji/%E5%9B%BA%E5%AE%9A?font=mincho&color=8b5cf6&animation=nami&speed=slow&background=transparent&outline=darker&outline_width=2" alt="固定" height="24" align="absmiddle"> → proxy upgrade で storage layout 変更しない設計
- view 関数 (`tokenURI`) からの decode コストは on-chain で誰も払わない

### 3. text の制約（契約レベル強制は別サイクル）

| 文字種 | 文字数 | UTF-8 bytes |
|---|---|---|
| 漢字 | 1〜2 文字 | 3〜6 bytes |
| ひらがな | 1〜4 文字 | 3〜12 bytes |
| 改行 `\n` | 0〜1 個（漢字 / ひらがなと組み合わせ可） | 1 byte |

最大ケース（ひらがな 2 + `\n` + ひらがな 2）= **13 bytes ≪ 31 bytes**。`bytes32` に <img src="https://mojiemoji.jozo.beer/emoji/%E4%BD%99%E8%A3%95?font=maru-bold&color=22c55e&animation=kirari&speed=normal&background=transparent&outline=darker&outline_width=2" alt="余裕" height="24" align="absmiddle"> で収まる。

### 4. URL の percent-encode は Solidity 内で実装

`tokenURI` は `view` 関数なので、ガス代を誰も払わない（marketplace / wallet / explorer が読み取り call で消費する分は chain 側で計算するだけ）。20 行程度の percent-encode ループは <img src="https://mojiemoji.jozo.beer/emoji/%E5%AE%9F%E8%B3%AA?font=gothic-bold&color=10b981&animation=tenmetsu&speed=slow&background=transparent&outline=darker&outline_width=2" alt="実質" height="24" align="absmiddle"><img src="https://mojiemoji.jozo.beer/emoji/%E7%84%A1%E6%96%99?font=gothic-bold&color=10b981&animation=tenmetsu&speed=slow&background=transparent&outline=darker&outline_width=2" alt="無料" height="24" align="absmiddle">。

unreserved characters（`[A-Za-z0-9\-._~]`）以外を `%XX` 形式で展開する標準的な実装。

## Consequences（帰結）

### Pros

- **コスト <img src="https://mojiemoji.jozo.beer/emoji/%E5%9B%BA%E5%AE%9A?font=mincho&color=8b5cf6&animation=nami&speed=slow&background=transparent&outline=darker&outline_width=2" alt="固定" height="24" align="absmiddle">**：mint 時に文字数で変動しない <img src="https://mojiemoji.jozo.beer/emoji/%E7%B5%8C%E6%B8%88%E6%80%A7?font=gothic-bold&color=22c55e&animation=disco&speed=fast&background=transparent&outline=darker&outline_width=2" alt="経済性" height="24" align="absmiddle">（10 万 mint 想定に必須）
- **upgrade <img src="https://mojiemoji.jozo.beer/emoji/%E5%AE%89%E5%85%A8?font=maru-bold&color=34d399&animation=kira&speed=slow&background=transparent&outline=darker&outline_width=2" alt="安全" height="24" align="absmiddle">**：storage layout は最初から `bytes32` 1 slot で固定 ─ 後で表現を変える必要がない
- **Dream の <img src="https://mojiemoji.jozo.beer/emoji/%E8%87%AA%E7%84%B6?font=maru&color=3b82f6&animation=bure&speed=normal&background=transparent&outline=darker&outline_width=2" alt="自然" height="24" align="absmiddle"> な解釈**：「短いキャッチコピー専門 NFT」として綺麗
- **画像ホスティング完全 <img src="https://mojiemoji.jozo.beer/emoji/%E3%82%BC%E3%83%AD?font=maru-bold&color=06b6d4&animation=shuchusen&speed=normal&background=transparent&outline=darker&outline_width=2" alt="ゼロ" height="24" align="absmiddle"><img src="https://mojiemoji.jozo.beer/emoji/%E4%BE%9D%E5%AD%98?font=maru-bold&color=06b6d4&animation=shuchusen&speed=normal&background=transparent&outline=darker&outline_width=2" alt="依存" height="24" align="absmiddle">**：IPFS / Arweave / S3 すべて不使用

### Cons / TODO

- **文字種・文字数の契約レベル強制** が <img src="https://mojiemoji.jozo.beer/emoji/%E5%BF%85%E9%A0%88?font=mincho&color=f97316&animation=mabataki&speed=slow&background=transparent&outline=darker&outline_width=2" alt="必須" height="24" align="absmiddle">（後続 TDD サイクルで駆動）
  - 漢字以外の文字種を含む text は revert
  - 文字数上限超過は revert
  - 改行 2 個以上は revert
- **`bytes32` 末尾 NUL の trim ロジック**実装が必要
- **`mojiemoji.jozo.beer` 側の URL 仕様**（query の percent-encode 受領）に依存 ─ 仕様変更時は contract upgrade が必要

## Alternatives Considered（検討した代替案）

| 案 | 不採用理由 |
|---|---|
| `bytes` 無制限 storage | ガス代が文字数線形に増加。10 万 mint の経済性が <img src="https://mojiemoji.jozo.beer/emoji/%E5%B4%A9%E3%82%8C%E3%82%8B?font=dela&color=dc2626&animation=psycho&speed=normal&background=transparent&outline=darker&outline_width=2" alt="崩れる" height="24" align="absmiddle"> |
| 6-bit packed ASCII（64 文字集合） | 日本語 <img src="https://mojiemoji.jozo.beer/emoji/%E4%B8%8D%E5%8F%AF?font=mincho&color=dc2626&animation=tate_scroll&speed=slow&background=transparent&outline=darker&outline_width=2" alt="不可" height="24" align="absmiddle">。mojiemoji の本質を <img src="https://mojiemoji.jozo.beer/emoji/%E5%A4%B1%E3%81%86?font=dela&color=f97316&animation=yoko_scroll&speed=normal&background=transparent&outline=darker&outline_width=2" alt="失う" height="24" align="absmiddle"> |
| Huffman / 辞書圧縮 | 短文字列にオーバーヘッド勝ち。Solidity decode 重い |
| SSTORE2 / SSTORE3 | 小さな blob には deploy オーバーヘッドが勝つ |
| IPFS / Arweave 外部保存 | Dream <img src="https://mojiemoji.jozo.beer/emoji/%E9%81%95%E5%8F%8D?font=dela&color=ef4444&animation=gatagata&speed=normal&background=transparent&outline=darker&outline_width=2" alt="違反" height="24" align="absmiddle">（[`CLAUDE.md`](../../.claude/CLAUDE.md) で明示的に却下） |
| 文字列もハッシュ派生（ユーザー入力不可） | Dream の魅力（自分の言葉を NFT 化）を <img src="https://mojiemoji.jozo.beer/emoji/%E5%A4%B1%E3%81%86?font=dela&color=f97316&animation=yoko_scroll&speed=normal&background=transparent&outline=darker&outline_width=2" alt="失う" height="24" align="absmiddle"> |

## References

- 起点議論：`ignite` skill の Phase 1〜4（2026-05-19）
- TDD 第 1 サイクル：[`test/testEMJTokenURI.ts`](../../test/testEMJTokenURI.ts) `Returns mojiemoji URL composed from on-chain bytes32 text Param`（現状 Red）
- 関連：[`.claude/CLAUDE.md`](../../.claude/CLAUDE.md)「採用したパターン / 捨てたパターン」
- 後続予定：ADR-0002（他 Param のハッシュ派生戦略）、ADR-0003（access control とライフサイクル）
