# ADR-0002: Stamp.text を Upgradeable Dictionary 経由のハッシュ <img src="https://mojiemoji.jozo.beer/emoji/%E6%B4%BE%E7%94%9F?font=gothic-bold&color=ec4899&animation=bane&speed=normal&background=transparent&outline=darker&outline_width=2" alt="派生" height="24" align="absmiddle"> に変更

- 採択日: 2026-05-20
- ステータス: Accepted
- 関係者: jozobeer
- 関連: ADR-0001 を **partial supersede**（text の入力経路のみ変更、storage は維持）

## Context（背景）

ADR-0001 では Stamp.text を **ユーザー入力** として `mapping(uint256 => bytes32) _stampText` に格納する設計を採択。しかし `setStampText` 駆動の access control / validation 検討中に <img src="https://mojiemoji.jozo.beer/emoji/%E6%A0%B9%E6%9C%AC?font=mincho&color=f59e0b&animation=mabataki&speed=slow&background=transparent&outline=darker&outline_width=2" alt="根本" height="24" align="absmiddle"> 問題が再浮上した：

- **ガス代の <img src="https://mojiemoji.jozo.beer/emoji/%E7%B5%8C%E6%B8%88%E6%80%A7?font=gothic-bold&color=dc2626&animation=psycho&speed=normal&background=transparent&outline=darker&outline_width=2" alt="経済性" height="24" align="absmiddle">**：10 万 mint × user input 管理（access control / validation / 衝突回避）は <img src="https://mojiemoji.jozo.beer/emoji/%E9%9B%A3%E3%81%97%E3%81%84?font=dela&color=ef4444&animation=gatagata&speed=normal&background=transparent&outline=darker&outline_width=2" alt="難しい" height="24" align="absmiddle">
- **UX の <img src="https://mojiemoji.jozo.beer/emoji/%E7%A0%B4%E7%B6%BB?font=dela&color=f97316&animation=bure&speed=normal&background=transparent&outline=darker&outline_width=2" alt="破綻" height="24" align="absmiddle">**：ユーザーが「焼き」を入力したくても、先に取られていると競合
- **辞書 contract の業界調査**（3 agent 並列、Etherscan / GitHub / NFT 生態系）の結論：**既存の借用可能な日本語辞書 contract は存在しない**。Loot 方式（辞書 + tokenId hash 抽選）が業界主流、日本語特化の決定論派生は **前例ゼロ**

→ Dream の「mojiemoji を永続化」の核は **画像ホスティングを持たないオンチェーン NFT** であって、「ユーザーが好きな文字を選ぶ」は <img src="https://mojiemoji.jozo.beer/emoji/%E4%BB%98%E9%9A%8F?font=maru&color=8b5cf6&animation=neruneru&speed=slow&background=transparent&outline=darker&outline_width=2" alt="付随" height="24" align="absmiddle"> 的な要素と再評価。**Loot パターンを日本語に適用した初の事例** になることを <img src="https://mojiemoji.jozo.beer/emoji/%E9%81%B8%E6%8A%9E?font=gothic-bold&color=3b82f6&animation=tenmetsu&speed=slow&background=transparent&outline=darker&outline_width=2" alt="選択" height="24" align="absmiddle"> する。

## Decision（決定）

### 1. Stamp.text は Dictionary 経由の <img src="https://mojiemoji.jozo.beer/emoji/%E6%B4%BE%E7%94%9F?font=gothic-bold&color=ec4899&animation=bane&speed=normal&background=transparent&outline=darker&outline_width=2" alt="派生" height="24" align="absmiddle">、user input は廃止

`tokenURI(tokenId)` 実行時に（**以下は言語非依存の擬似表記**。Solidity 実装では `bytes32` を `uint256` キャスト＋シフトで上位 / 下位 128 bit に分割するなど）：

```
hash       = keccak256(abi.encode(tokenId))
kanjiIdx   = upper128(hash) % kanjiSnapshot[tokenId]
hiraIdx    = lower128(hash) % hiraganaSnapshot[tokenId]
text       = abi.encodePacked(dict.kanjiAt(kanjiIdx), dict.hiraganaAt(hiraIdx))
// 漢字 1 + ひらがな N など、テンプレート規則は実装側
```

ユーザー入力 API（`setStampText`）は **削除**。

### 2. Dictionary は別 contract + **UUPS Upgradeable**

```solidity
interface IDictionary {
    // 返り値は UTF-8 生 bytes（呼び出し側で abi.encodePacked により直接結合可能）
    function kanjiAt(uint256 index) external view returns (bytes memory);
    function kanjiCount() external view returns (uint256);
    function hiraganaAt(uint256 index) external view returns (bytes memory);
    function hiraganaCount() external view returns (uint256);

    // append-only。漢字 / ひらがなそれぞれに追加 API を提供
    function addKanji(bytes[] calldata words) external;     // onlyOwner
    function addHiragana(bytes[] calldata words) external;  // onlyOwner
}
```

EMJ と Dictionary はそれぞれ <img src="https://mojiemoji.jozo.beer/emoji/%E7%8B%AC%E7%AB%8B?font=maru-bold&color=22c55e&animation=mochimochi&speed=slow&background=transparent&outline=darker&outline_width=2" alt="独立" height="24" align="absmiddle"> な UUPS proxy として deploy し、external call で連携：

```
EMJ (UUPS) ──external call──> Dictionary (UUPS)
```

Dictionary を独立 deploy する <img src="https://mojiemoji.jozo.beer/emoji/%E5%88%A9%E7%82%B9?font=gothic-bold&color=60a5fa&animation=kirari&speed=normal&background=transparent&outline=darker&outline_width=2" alt="利点" height="24" align="absmiddle">：他プロジェクトからも借用可能な public good になる（mojiemoji 互換の日本語語彙 oracle）。

### 3. Dictionary は **append-only**（書き換え禁止）

- `addKanji(bytes[] calldata)` / `addHiragana(bytes[] calldata)` の **追加 API のみ** 提供
- `setKanji(index, word)` / `removeKanji(index)` / `setHiragana` / `removeHiragana` は **提供しない**
- modifier / require レベルで <img src="https://mojiemoji.jozo.beer/emoji/%E5%BC%B7%E5%88%B6?font=mincho&color=ef4444&animation=bure&speed=normal&background=transparent&outline=darker&outline_width=2" alt="強制" height="24" align="absmiddle">

→ 既存 index は **永久に同じ文字を指す**。新規語彙は末尾追加だけ。漢字 / ひらがな双方とも append 可（テンプレ規則で漢字 0 文字パターンを許容する場合があるため、ひらがな側も拡張余地を残す）。

### 4. 派生ロジックは EMJ 側に <img src="https://mojiemoji.jozo.beer/emoji/%E5%9B%BA%E5%AE%9A?font=mincho&color=8b5cf6&animation=nami&speed=slow&background=transparent&outline=darker&outline_width=2" alt="固定" height="24" align="absmiddle">、Dictionary はデータ層のみ

Dictionary は配列 lookup だけを提供し、派生アルゴリズム（hash → index → 文字組み合わせ）は EMJ contract 内に実装。

理由：派生ロジックを Upgradeable Dictionary 側に持たせると **過去 token の派生結果が後から変わる** リスク。Dream の「URL = 画像の永続化」と <img src="https://mojiemoji.jozo.beer/emoji/%E7%9F%9B%E7%9B%BE?font=dela&color=dc2626&animation=psycho&speed=normal&background=transparent&outline=darker&outline_width=2" alt="矛盾" height="24" align="absmiddle">。データだけ append-only なら安全。

### 5. tokenURI <img src="https://mojiemoji.jozo.beer/emoji/%E6%B0%B8%E7%B6%9A%E5%8C%96?font=maru-bold&color=34d399&animation=mochimochi&speed=slow&background=transparent&outline=darker&outline_width=2" alt="永続化" height="24" align="absmiddle"> のため mint 時に Dictionary count を **batch 起点 tokenId per** で snapshot

ERC721Psi の batch mint と <img src="https://mojiemoji.jozo.beer/emoji/%E6%95%B4%E5%90%88?font=gothic-bold&color=06b6d4&animation=shuchusen&speed=normal&background=transparent&outline=darker&outline_width=2" alt="整合" height="24" align="absmiddle"> させるため、snapshot は **batch 起点 tokenId だけに書き込む**（batch 内 token は起点を lookup して同じ snapshot を参照）：

```solidity
// batch start tokenId のみに書く。batch 内の他 token は起点を逆引きして参照
mapping(uint256 => uint256) private _kanjiSnapshotAtBatchStart;
mapping(uint256 => uint256) private _hiraganaSnapshotAtBatchStart;
```

派生時：

```solidity
uint256 start = _batchStartOf(tokenId);  // ERC721Psi が提供する起点 lookup
uint256 kanjiRange = _kanjiSnapshotAtBatchStart[start];
uint256 idx = uint256(hashSlice) % kanjiRange;
```

これにより：

- **既存 token の派生結果は <img src="https://mojiemoji.jozo.beer/emoji/%E6%B0%B8%E9%81%A0?font=dela&color=22c55e&animation=kira&speed=normal&background=transparent&outline=darker&outline_width=2" alt="永遠" height="24" align="absmiddle"> 不変**（snapshot 時の range だけ使う）
- **新規 mint だけが拡張された語彙を享受**
- **batch mint のガス効率を <img src="https://mojiemoji.jozo.beer/emoji/%E7%B6%AD%E6%8C%81?font=gothic-bold&color=22c55e&animation=kirari&speed=normal&background=transparent&outline=darker&outline_width=2" alt="維持" height="24" align="absmiddle">**：batch サイズ N に対して snapshot SSTORE は 2 回 (kanji / hiragana) で済む（per-token なら 2N 回）

Pros の「mint コスト劇減」はこの batch 単位 snapshot を前提とする。tokenId per で持つと batch mint のスケール感が失われるため、**batch 単位を ADR 確定事項として明示**。

### 6. ADR-0001 storage `_stampText` は **廃止**

mint 時に text を保存しない → `mapping(uint256 => bytes32) _stampText` は不要。proxy upgrade で <img src="https://mojiemoji.jozo.beer/emoji/%E7%84%A1%E5%8A%B9%E5%8C%96?font=mincho&color=f97316&animation=tate_scroll&speed=slow&background=transparent&outline=darker&outline_width=2" alt="無効化" height="24" align="absmiddle">（slot 自体は残るが書かない／読まない）。`setStampText` / `_stampText` 関連は removed。

## Consequences（帰結）

### Pros

- **mint コスト <img src="https://mojiemoji.jozo.beer/emoji/%E5%8A%87%E6%B8%9B?font=gothic-bold&color=22c55e&animation=disco&speed=fast&background=transparent&outline=darker&outline_width=2" alt="劇減" height="24" align="absmiddle">**：text の SSTORE が消える代わりに snapshot 2 slot 追加。batch mint 1 回で済めば実質変わらず
- **語彙の <img src="https://mojiemoji.jozo.beer/emoji/%E9%80%B2%E5%8C%96?font=maru-bold&color=10b981&animation=yatta&speed=normal&background=transparent&outline=darker&outline_width=2" alt="進化" height="24" align="absmiddle">**：Dictionary に `addKanji` するだけで新規 token のバリエーション拡張
- **URL <img src="https://mojiemoji.jozo.beer/emoji/%E4%B8%8D%E5%A4%89?font=mincho&color=8b5cf6&animation=nami&speed=slow&background=transparent&outline=darker&outline_width=2" alt="不変" height="24" align="absmiddle">**：snapshot で過去 token の派生結果は永久固定
- **Public good**：Dictionary contract を切り出すと、他の日本語 NFT プロジェクトが external call で借用可能
- **業界 <img src="https://mojiemoji.jozo.beer/emoji/%E5%85%88%E9%A7%86?font=gothic-bold&color=ec4899&animation=shuchusen&speed=normal&background=transparent&outline=darker&outline_width=2" alt="先駆" height="24" align="absmiddle"> ポジション**：日本語の決定論的 text generation の前例なし

### Cons / TODO

- **ユーザー入力の <img src="https://mojiemoji.jozo.beer/emoji/%E8%87%AA%E7%94%B1?font=dela&color=f97316&animation=yoko_scroll&speed=normal&background=transparent&outline=darker&outline_width=2" alt="自由" height="24" align="absmiddle"> を <img src="https://mojiemoji.jozo.beer/emoji/%E5%96%AA%E5%A4%B1?font=dela&color=dc2626&animation=gatagata&speed=normal&background=transparent&outline=darker&outline_width=2" alt="喪失" height="24" align="absmiddle">**：「自分の言葉を NFT 化」体験は今後の課題（後続 ADR で復活余地検討）
- **辞書サイズと <img src="https://mojiemoji.jozo.beer/emoji/%E5%88%9D%E6%9C%9F?font=gothic-bold&color=3b82f6&animation=tenmetsu&speed=slow&background=transparent&outline=darker&outline_width=2" alt="初期" height="24" align="absmiddle"> 内容**は別 issue（形態素テンプレ案 / シンプル合成案）
- **テンプレ規則**（漢字 1 / 漢字 2 / 漢字 + 改行 + ひらがな など）の組み合わせロジックも別 issue
- **Dictionary contract の owner / upgrade 権限**の access control 設計（multisig / timelock 検討）は別 ADR
- **storage layout migration**：`_stampText` slot を残したまま `_kanjiSnapshot` / `_hiraganaSnapshot` を新規追加（layout 互換）

## Alternatives Considered（検討した代替案）

| 案 | 不採用理由 |
|---|---|
| 自前 contract に辞書を <img src="https://mojiemoji.jozo.beer/emoji/%E5%86%85%E5%8C%85?font=gothic-bold&color=8b5cf6&animation=bure&speed=normal&background=transparent&outline=darker&outline_width=2" alt="内包" height="24" align="absmiddle">（別 contract にしない） | 語彙拡張のたびに EMJ proxy upgrade が必要。upgrade 影響範囲が <img src="https://mojiemoji.jozo.beer/emoji/%E5%BA%83%E3%81%84?font=dela&color=ef4444&animation=psycho&speed=normal&background=transparent&outline=darker&outline_width=2" alt="広い" height="24" align="absmiddle">。public good 化も不可 |
| Dictionary immutable（Upgradeable にしない） | 辞書追加できない。10 万 mint で語彙 <img src="https://mojiemoji.jozo.beer/emoji/%E6%9E%AF%E6%B8%87?font=mincho&color=dc2626&animation=tate_scroll&speed=slow&background=transparent&outline=darker&outline_width=2" alt="枯渇" height="24" align="absmiddle"> リスク |
| Dictionary 側に派生ロジック | upgrade で過去 token の派生結果が <img src="https://mojiemoji.jozo.beer/emoji/%E5%A4%89%E5%8C%96?font=dela&color=f97316&animation=gatagata&speed=normal&background=transparent&outline=darker&outline_width=2" alt="変化" height="24" align="absmiddle">。Dream 違反 |
| GojuoNFT (`0xbee3...64d2`) 借用 | ローマ字格納で日本語 bytes を持たない。license 未指定で商用組み込み <img src="https://mojiemoji.jozo.beer/emoji/%E5%8D%B1%E9%99%BA?font=mincho&color=dc2626&animation=psycho&speed=normal&background=transparent&outline=darker&outline_width=2" alt="危険" height="24" align="absmiddle"> |
| append-only 不採用（任意の index 書き換え可） | 過去 token の派生結果が <img src="https://mojiemoji.jozo.beer/emoji/%E7%A0%B4%E5%A3%8A?font=dela&color=ef4444&animation=bure&speed=normal&background=transparent&outline=darker&outline_width=2" alt="破壊" height="24" align="absmiddle">。永続性詰む |
| snapshot 不採用（`dict.kanjiCount()` を直接 mod に使う） | append のたびに既存 token の text が <img src="https://mojiemoji.jozo.beer/emoji/%E5%A4%89%E5%8C%96?font=dela&color=f97316&animation=gatagata&speed=normal&background=transparent&outline=darker&outline_width=2" alt="変化" height="24" align="absmiddle">。URL 永続性詰む |
| 固定枠 indexing（256 字 chunk 等で永続性保証） | アルゴリズムが <img src="https://mojiemoji.jozo.beer/emoji/%E8%A4%87%E9%9B%91?font=dela&color=f97316&animation=psycho&speed=normal&background=transparent&outline=darker&outline_width=2" alt="複雑" height="24" align="absmiddle">、bug 余地多い。snapshot 方式の方が明示的 |

## References

- 調査結果（3 agent 並列）：Etherscan / GitHub / NFT 生態系を網羅、日本語辞書 contract の前例なしと確認
- [Loot (for Adventurers) contract](https://etherscan.io/address/0xff9c1b15b16263c61d017ee9f65c50e4ae0113d7) — 業界主流 Loot パターンのリファレンス実装
- [GojuoNFT](https://etherscan.io/address/0xbee3eeeb8ba59f0a3b3e0a302ef921d6d01e64d2) — 唯一の比較対象（不採用）
- [ADR-0001](./0001-tokenuri-dream-spec.md) — text storage 設計（本 ADR で partial supersede）
- 後続予定：ADR-0003（辞書の初期語彙と派生テンプレ規則）、ADR-0004（Dictionary owner / upgrade 権限）
