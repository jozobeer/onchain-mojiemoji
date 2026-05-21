# ADR-0002: Stamp.text を Upgradeable Dictionary 経由のハッシュ <img src="https://mojiemoji.jozo.beer/emoji/%E6%B4%BE%E7%94%9F?font=gothic-bold&color=ec4899&animation=bane&speed=normal&background=transparent&outline=darker&outline_width=2" alt="派生" height="24" align="absmiddle"> に変更（単語完成形 + TS validator 責務分離）

- 採択日: 2026-05-20
- 改訂日: 2026-05-21（単語完成形 + TS validator 責務分離に大幅 update）
- ステータス: Accepted
- 関係者: jozobeer
- 関連: ADR-0001 を **completely supersede**（text storage / 文字種制約 / 13 bytes 制約をすべて廃止）

## Context（背景）

ADR-0001 では Stamp.text を **ユーザー入力** として `mapping(uint256 => bytes32) _stampText` に格納する設計を採択。しかし `setStampText` 駆動の access control / validation 検討中に <img src="https://mojiemoji.jozo.beer/emoji/%E6%A0%B9%E6%9C%AC?font=mincho&color=f59e0b&animation=mabataki&speed=slow&background=transparent&outline=darker&outline_width=2" alt="根本" height="24" align="absmiddle"> 問題が再浮上：

- **ガス代の <img src="https://mojiemoji.jozo.beer/emoji/%E7%B5%8C%E6%B8%88%E6%80%A7?font=gothic-bold&color=dc2626&animation=psycho&speed=normal&background=transparent&outline=darker&outline_width=2" alt="経済性" height="24" align="absmiddle">**：10 万 mint × user input 管理（access control / validation / 衝突回避）は <img src="https://mojiemoji.jozo.beer/emoji/%E9%9B%A3%E3%81%97%E3%81%84?font=dela&color=ef4444&animation=gatagata&speed=normal&background=transparent&outline=darker&outline_width=2" alt="難しい" height="24" align="absmiddle">
- **UX の <img src="https://mojiemoji.jozo.beer/emoji/%E7%A0%B4%E7%B6%BB?font=dela&color=f97316&animation=bure&speed=normal&background=transparent&outline=darker&outline_width=2" alt="破綻" height="24" align="absmiddle">**：ユーザーが「焼き」を入力したくても、先に取られていると競合
- **辞書 contract の業界調査**（3 agent 並列、Etherscan / GitHub / NFT 生態系）の結論：**既存の借用可能な日本語辞書 contract は存在しない**。Loot 方式（辞書 + tokenId hash 抽選）が業界主流、日本語特化の決定論派生は **前例ゼロ**

→ Dream の「mojiemoji を永続化」の核は **画像ホスティングを持たないオンチェーン NFT** であって、「ユーザーが好きな文字を選ぶ」は <img src="https://mojiemoji.jozo.beer/emoji/%E4%BB%98%E9%9A%8F?font=maru&color=8b5cf6&animation=neruneru&speed=slow&background=transparent&outline=darker&outline_width=2" alt="付随" height="24" align="absmiddle"> 的な要素と再評価。**Loot パターンを日本語に適用した初の事例** になることを <img src="https://mojiemoji.jozo.beer/emoji/%E9%81%B8%E6%8A%9E?font=gothic-bold&color=3b82f6&animation=tenmetsu&speed=slow&background=transparent&outline=darker&outline_width=2" alt="選択" height="24" align="absmiddle"> する。

### 初回起稿後の追加検討

初版（2026-05-20）では「漢字 / ひらがなの 2 配列 + EMJ 側で組み合わせ派生」を採用したが、tdd-spec サイクル中に以下の問題が判明：

- **活用の <img src="https://mojiemoji.jozo.beer/emoji/%E7%A0%B4%E7%B6%BB?font=dela&color=f97316&animation=bure&speed=normal&background=transparent&outline=darker&outline_width=2" alt="破綻" height="24" align="absmiddle">**：「勝しい」「焼たい」のような文法的に成立しない組み合わせが派生する可能性
- **テンプレ規則の <img src="https://mojiemoji.jozo.beer/emoji/%E8%A4%87%E9%9B%91?font=dela&color=f97316&animation=psycho&speed=normal&background=transparent&outline=darker&outline_width=2" alt="複雑" height="24" align="absmiddle">**：漢字 1 / 漢字 2 / 漢字 + ひらがな などのパターン管理が contract 側に必要
- **contract 内 validation の gas <img src="https://mojiemoji.jozo.beer/emoji/%E9%87%8D%E3%81%84?font=mincho&color=dc2626&animation=psycho&speed=normal&background=transparent&outline=darker&outline_width=2" alt="重い" height="24" align="absmiddle">**：重複チェック O(n) を `addWords` に入れると書き込みコストが配列サイズ線形に増加

→ **改訂版**：単語の **完成形** を 1 配列で持ち、validation は TypeScript 側に寄せる設計に変更。

## Decision（決定）

### 1. Stamp.text は Dictionary 経由の <img src="https://mojiemoji.jozo.beer/emoji/%E6%B4%BE%E7%94%9F?font=gothic-bold&color=ec4899&animation=bane&speed=normal&background=transparent&outline=darker&outline_width=2" alt="派生" height="24" align="absmiddle">、user input は廃止

`tokenURI(tokenId)` 実行時に：

```
hash      = keccak256(abi.encode(tokenId))
wordIdx   = uint256(hash) % wordSnapshot[batchStartOf(tokenId)]
text      = dict.wordAt(wordIdx)
// 完成形を 1 配列から引くだけ。組み合わせ / テンプレ規則なし
```

ユーザー入力 API（`setStampText`）は **削除**。

### 2. Dictionary は **単語完成形を 1 配列で保持**

漢字 / ひらがな 2 配列 + EMJ 側組み合わせは <img src="https://mojiemoji.jozo.beer/emoji/%E5%BB%83%E6%AD%A2?font=mincho&color=dc2626&animation=tate_scroll&speed=slow&background=transparent&outline=darker&outline_width=2" alt="廃止" height="24" align="absmiddle">。「焼く」「勝った」「夢を見る」「光る」のように、文法的に成立した **完成形の単語** を 1 配列で保持し、EMJ は index 抽選で 1 単語を引くだけ。

```solidity
interface IDictionary {
    // 返り値は UTF-8 生 bytes（呼び出し側で URL 組み立てに直接使用）
    function wordAt(uint256 index) external view returns (bytes memory);
    function wordCount() external view returns (uint256);

    // append-only。重複 / validation は呼び出し側の責務
    function addWords(bytes[] calldata words) external;  // onlyOwner
}
```

### 3. Dictionary は別 contract + **UUPS Upgradeable**

EMJ と Dictionary はそれぞれ <img src="https://mojiemoji.jozo.beer/emoji/%E7%8B%AC%E7%AB%8B?font=maru-bold&color=22c55e&animation=mochimochi&speed=slow&background=transparent&outline=darker&outline_width=2" alt="独立" height="24" align="absmiddle"> な UUPS proxy として deploy し、external call で連携：

```
EMJ (UUPS) ──external call──> Dictionary (UUPS)
```

Dictionary を独立 deploy する <img src="https://mojiemoji.jozo.beer/emoji/%E5%88%A9%E7%82%B9?font=gothic-bold&color=60a5fa&animation=kirari&speed=normal&background=transparent&outline=darker&outline_width=2" alt="利点" height="24" align="absmiddle">：他プロジェクトからも借用可能な public good（mojiemoji 互換の日本語語彙 oracle）。

### 4. 初期語彙は `initialize` 引数で TypeScript から注入

contract source code に文字をハードコードしない。`scripts/deployDictionary.ts` で本番リストを定義し、proxy deploy 時の initializer 引数として渡す：

```solidity
function initialize(bytes[] calldata initialWords) public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();
    _appendWords(initialWords);
}
```

```typescript
// scripts/deployDictionary.ts
const INITIAL_WORDS = [
    "焼く", "勝った", "夢を見る", "光る", /* ... */
].map(s => ethers.toUtf8Bytes(s))

const dict = await upgrades.deployProxy(
    DictionaryFactory,
    [INITIAL_WORDS],
    { kind: "uups" },
)
```

これにより：

- **contract source は generic** ─ 他プロジェクトが借用するときも自分の語彙を渡せる
- **test は小さい dummy で deploy 可能** ─ test 同期コストなし
- **本番リストは git 管理** ─ `scripts/dictionary/` 配下で version control、選定変更は別 PR

### 5. Dictionary は **append-only**（書き換え禁止）

- `addWords(bytes[] calldata)` の **追加 API のみ** 提供
- `setWord(index, word)` / `removeWord(index)` は **提供しない**（interface に存在しない時点で ABI 経由で呼べない）

→ 既存 index は **永久に同じ単語を指す**。新規語彙は末尾追加だけ。

### 6. Validation / 重複検出 / 長さチェックは **TypeScript の責務**

contract 内では一切 validation しない（**dumb data store**）。理由：

- **重複チェックは O(n)**：既存配列を全 iterate する必要があり、append のたびに書き込み gas が配列サイズ線形に膨らむ。100 単語で 5×、500 単語で 25×。商用 NFT として <img src="https://mojiemoji.jozo.beer/emoji/%E8%A8%B1%E5%AE%B9%E4%B8%8D%E5%8F%AF?font=mincho&color=dc2626&animation=tate_scroll&speed=slow&background=transparent&outline=darker&outline_width=2" alt="許容不可" height="24" align="absmiddle">
- **長さチェック / 文字種 validation も同様**：append サイズに比例した余計な gas
- **TS 側に寄せれば 1 回限りの off-chain チェック**：deploy / 追加投入の都度、`scripts/dictionary/sanitize.ts` で精査

責務分離：

| 責務 | 場所 |
|---|---|
| 単語の正規化（前後 whitespace trim 等） | `scripts/dictionary/sanitize.ts` |
| 空文字列 / 空 bytes の除外 | `scripts/dictionary/sanitize.ts` |
| 重複検出（Set / Map） | `scripts/dictionary/sanitize.ts` |
| 文字種 validation（漢字 / ひらがな / 改行以外を除外） | `scripts/dictionary/sanitize.ts` |
| URL に渡せる bytes 長制約（mojiemoji 仕様） | `scripts/dictionary/sanitize.ts` |
| `onlyOwner` access control | Dictionary contract |
| append-only 強制（setter 不在） | Dictionary contract |
| `addWords` の dumb append | Dictionary contract |
| `WordsAdded(uint256 startIndex, uint256 count)` event emit | Dictionary contract |

contract 側で残るのは **access control + setter 不在による append-only 強制 + event emit** だけ。

### 7. 派生ロジックは EMJ 側に <img src="https://mojiemoji.jozo.beer/emoji/%E5%9B%BA%E5%AE%9A?font=mincho&color=8b5cf6&animation=nami&speed=slow&background=transparent&outline=darker&outline_width=2" alt="固定" height="24" align="absmiddle">、Dictionary はデータ層のみ

Dictionary は配列 lookup だけを提供し、派生アルゴリズム（hash → index → 単語 lookup）は EMJ contract 内に実装。

理由：派生ロジックを Upgradeable Dictionary 側に持たせると **過去 token の派生結果が後から変わる** リスク。Dream の「URL = 画像の永続化」と <img src="https://mojiemoji.jozo.beer/emoji/%E7%9F%9B%E7%9B%BE?font=dela&color=dc2626&animation=psycho&speed=normal&background=transparent&outline=darker&outline_width=2" alt="矛盾" height="24" align="absmiddle">。データだけ append-only なら安全。

### 8. tokenURI <img src="https://mojiemoji.jozo.beer/emoji/%E6%B0%B8%E7%B6%9A%E5%8C%96?font=maru-bold&color=34d399&animation=mochimochi&speed=slow&background=transparent&outline=darker&outline_width=2" alt="永続化" height="24" align="absmiddle"> のため mint 時に Dictionary count を **batch 起点 tokenId per** で snapshot

ERC721Psi の batch mint と <img src="https://mojiemoji.jozo.beer/emoji/%E6%95%B4%E5%90%88?font=gothic-bold&color=06b6d4&animation=shuchusen&speed=normal&background=transparent&outline=darker&outline_width=2" alt="整合" height="24" align="absmiddle"> させるため、snapshot は **batch 起点 tokenId だけに書き込む**（batch 内 token は起点を lookup して同じ snapshot を参照）：

```solidity
// batch start tokenId のみに書く。batch 内の他 token は起点を逆引きして参照
mapping(uint256 => uint256) private _wordSnapshotAtBatchStart;
```

派生時：

```solidity
uint256 start = _batchStartOf(tokenId);  // ERC721Psi が提供する起点 lookup
uint256 range = _wordSnapshotAtBatchStart[start];
uint256 idx = uint256(keccak256(abi.encode(tokenId))) % range;
bytes memory text = dict.wordAt(idx);
```

これにより：

- **既存 token の派生結果は <img src="https://mojiemoji.jozo.beer/emoji/%E6%B0%B8%E9%81%A0?font=dela&color=22c55e&animation=kira&speed=normal&background=transparent&outline=darker&outline_width=2" alt="永遠" height="24" align="absmiddle"> 不変**（snapshot 時の range だけ使う）
- **新規 mint だけが拡張された語彙を享受**
- **batch mint のガス効率を <img src="https://mojiemoji.jozo.beer/emoji/%E7%B6%AD%E6%8C%81?font=gothic-bold&color=22c55e&animation=kirari&speed=normal&background=transparent&outline=darker&outline_width=2" alt="維持" height="24" align="absmiddle">**：batch サイズ N に対して snapshot SSTORE は **1 回固定**（per-token なら N 回）

### 9. ADR-0001 storage と文字種制約は **completely supersede**

| ADR-0001 で確定していた事項 | 本 ADR での扱い |
|---|---|
| `mapping(uint256 => bytes32) _stampText` | 廃止（slot は layout 互換のため残すが書かない／読まない） |
| Short String Optimization（bytes32 inline） | 不要（storage に text を持たない） |
| 漢字 1-2 / ひらがな 1-4 / 改行 1 個 / 13 bytes 制約 | contract レベルから削除、**単語選定の guideline に格下げ**（`scripts/dictionary/sanitize.ts` で TS validation） |
| `setStampText(uint256, bytes32)` API | 削除 |
| Solidity 内 percent-encode 実装 | 維持（`tokenURI` で UTF-8 bytes を URL に焼く処理） |

## Consequences（帰結）

### Pros

- **mint コスト <img src="https://mojiemoji.jozo.beer/emoji/%E5%8A%87%E6%B8%9B?font=gothic-bold&color=22c55e&animation=disco&speed=fast&background=transparent&outline=darker&outline_width=2" alt="劇減" height="24" align="absmiddle">**：text の SSTORE が消える代わりに snapshot 1 slot 追加（batch 単位）。batch mint 1 回で済めば実質変わらず
- **語彙の <img src="https://mojiemoji.jozo.beer/emoji/%E9%80%B2%E5%8C%96?font=maru-bold&color=10b981&animation=yatta&speed=normal&background=transparent&outline=darker&outline_width=2" alt="進化" height="24" align="absmiddle">**：Dictionary に `addWords` するだけで新規 token のバリエーション拡張
- **URL <img src="https://mojiemoji.jozo.beer/emoji/%E4%B8%8D%E5%A4%89?font=mincho&color=8b5cf6&animation=nami&speed=slow&background=transparent&outline=darker&outline_width=2" alt="不変" height="24" align="absmiddle">**：snapshot で過去 token の派生結果は永久固定
- **活用の <img src="https://mojiemoji.jozo.beer/emoji/%E5%AE%89%E5%85%A8?font=maru-bold&color=34d399&animation=kira&speed=slow&background=transparent&outline=darker&outline_width=2" alt="安全" height="24" align="absmiddle">**：完成形のみ登録するため「勝しい」「焼たい」のようなジャンクが生まれない
- **write gas の <img src="https://mojiemoji.jozo.beer/emoji/%E6%9C%80%E5%B0%8F?font=gothic-bold&color=22c55e&animation=kirari&speed=normal&background=transparent&outline=darker&outline_width=2" alt="最小" height="24" align="absmiddle">**：contract は dumb append のみ、validation gas が一切乗らない
- **Public good**：contract source が generic、自分の語彙で deploy 可能
- **業界 <img src="https://mojiemoji.jozo.beer/emoji/%E5%85%88%E9%A7%86?font=gothic-bold&color=ec4899&animation=shuchusen&speed=normal&background=transparent&outline=darker&outline_width=2" alt="先駆" height="24" align="absmiddle"> ポジション**：日本語の決定論的 text generation の前例なし

### Cons / TODO

- **ユーザー入力の <img src="https://mojiemoji.jozo.beer/emoji/%E8%87%AA%E7%94%B1?font=dela&color=f97316&animation=yoko_scroll&speed=normal&background=transparent&outline=darker&outline_width=2" alt="自由" height="24" align="absmiddle"> を <img src="https://mojiemoji.jozo.beer/emoji/%E5%96%AA%E5%A4%B1?font=dela&color=dc2626&animation=gatagata&speed=normal&background=transparent&outline=darker&outline_width=2" alt="喪失" height="24" align="absmiddle">**：「自分の言葉を NFT 化」体験は今後の課題（後続 ADR で復活余地検討）
- **off-chain validator の <img src="https://mojiemoji.jozo.beer/emoji/%E4%BF%A1%E9%A0%BC?font=mincho&color=f59e0b&animation=mabataki&speed=slow&background=transparent&outline=darker&outline_width=2" alt="信頼" height="24" align="absmiddle">**：deploy 前に `scripts/dictionary/sanitize.ts` を通す運用規律が必要。bypass されると重複や空 bytes が contract に焼き込まれる可能性（recover 不可、永続）
- **初期語彙の <img src="https://mojiemoji.jozo.beer/emoji/%E9%81%B8%E5%AE%9A?font=gothic-bold&color=3b82f6&animation=tenmetsu&speed=slow&background=transparent&outline=darker&outline_width=2" alt="選定" height="24" align="absmiddle">**：本番 deploy 前に確定要（別 issue / PR で詰める。「焼く」「勝った」「夢を見る」風の単語リスト）
- **Dictionary contract の owner / upgrade 権限**の access control 設計（multisig / timelock 検討）は別 ADR
- **storage layout migration**：`_stampText` slot を残したまま `_wordSnapshotAtBatchStart` を新規追加（layout 互換）

## Alternatives Considered（検討した代替案）

| 案 | 不採用理由 |
|---|---|
| 漢字 / ひらがな 2 配列 + EMJ 側組み合わせ | 活用の <img src="https://mojiemoji.jozo.beer/emoji/%E7%A0%B4%E7%B6%BB?font=dela&color=f97316&animation=bure&speed=normal&background=transparent&outline=darker&outline_width=2" alt="破綻" height="24" align="absmiddle">（「勝しい」「焼たい」）。テンプレ規則も別 ADR 必要で全体が <img src="https://mojiemoji.jozo.beer/emoji/%E8%A4%87%E9%9B%91?font=dela&color=f97316&animation=psycho&speed=normal&background=transparent&outline=darker&outline_width=2" alt="複雑" height="24" align="absmiddle"> |
| contract source code に初期語彙を hardcode | test と impl で同じリストを 2 重管理。public good 性低下。本番リスト変更時の diff が <img src="https://mojiemoji.jozo.beer/emoji/%E5%BA%83%E3%81%84?font=dela&color=ef4444&animation=psycho&speed=normal&background=transparent&outline=darker&outline_width=2" alt="広い" height="24" align="absmiddle"> |
| 自前 contract に辞書を <img src="https://mojiemoji.jozo.beer/emoji/%E5%86%85%E5%8C%85?font=gothic-bold&color=8b5cf6&animation=bure&speed=normal&background=transparent&outline=darker&outline_width=2" alt="内包" height="24" align="absmiddle">（別 contract にしない） | 語彙拡張のたびに EMJ proxy upgrade が必要。upgrade 影響範囲が <img src="https://mojiemoji.jozo.beer/emoji/%E5%BA%83%E3%81%84?font=dela&color=ef4444&animation=psycho&speed=normal&background=transparent&outline=darker&outline_width=2" alt="広い" height="24" align="absmiddle">。public good 化も不可 |
| Dictionary immutable（Upgradeable にしない） | 辞書追加できない。10 万 mint で語彙 <img src="https://mojiemoji.jozo.beer/emoji/%E6%9E%AF%E6%B8%87?font=mincho&color=dc2626&animation=tate_scroll&speed=slow&background=transparent&outline=darker&outline_width=2" alt="枯渇" height="24" align="absmiddle"> リスク |
| Dictionary 側に派生ロジック | upgrade で過去 token の派生結果が <img src="https://mojiemoji.jozo.beer/emoji/%E5%A4%89%E5%8C%96?font=dela&color=f97316&animation=gatagata&speed=normal&background=transparent&outline=darker&outline_width=2" alt="変化" height="24" align="absmiddle">。Dream 違反 |
| contract 内で重複 / 空 bytes / 長さ validation | append のたびに O(n) 走査で書き込み gas が配列サイズ線形に増加。100 単語で 5×、500 単語で 25× の <img src="https://mojiemoji.jozo.beer/emoji/%E7%88%86%E8%96%AC?font=dela&color=dc2626&animation=psycho&speed=normal&background=transparent&outline=darker&outline_width=2" alt="爆薬" height="24" align="absmiddle"> |
| GojuoNFT (`0xbee3...64d2`) 借用 | ローマ字格納で日本語 bytes を持たない。license 未指定で商用組み込み <img src="https://mojiemoji.jozo.beer/emoji/%E5%8D%B1%E9%99%BA?font=mincho&color=dc2626&animation=psycho&speed=normal&background=transparent&outline=darker&outline_width=2" alt="危険" height="24" align="absmiddle"> |
| append-only 不採用（任意の index 書き換え可） | 過去 token の派生結果が <img src="https://mojiemoji.jozo.beer/emoji/%E7%A0%B4%E5%A3%8A?font=dela&color=ef4444&animation=bure&speed=normal&background=transparent&outline=darker&outline_width=2" alt="破壊" height="24" align="absmiddle">。永続性詰む |
| snapshot 不採用（`dict.wordCount()` を直接 mod に使う） | append のたびに既存 token の text が <img src="https://mojiemoji.jozo.beer/emoji/%E5%A4%89%E5%8C%96?font=dela&color=f97316&animation=gatagata&speed=normal&background=transparent&outline=darker&outline_width=2" alt="変化" height="24" align="absmiddle">。URL 永続性詰む |
| 固定枠 indexing（256 単語 chunk 等で永続性保証） | アルゴリズムが <img src="https://mojiemoji.jozo.beer/emoji/%E8%A4%87%E9%9B%91?font=dela&color=f97316&animation=psycho&speed=normal&background=transparent&outline=darker&outline_width=2" alt="複雑" height="24" align="absmiddle">、bug 余地多い。snapshot 方式の方が明示的 |

## References

- 調査結果（3 agent 並列）：Etherscan / GitHub / NFT 生態系を網羅、日本語辞書 contract の前例なしと確認
- [Loot (for Adventurers) contract](https://etherscan.io/address/0xff9c1b15b16263c61d017ee9f65c50e4ae0113d7) — 業界主流 Loot パターンのリファレンス実装
- [GojuoNFT](https://etherscan.io/address/0xbee3eeeb8ba59f0a3b3e0a302ef921d6d01e64d2) — 唯一の比較対象（不採用）
- [ADR-0001](./0001-tokenuri-dream-spec.md) — text storage 設計（本 ADR で **completely supersede**）
- 後続予定：ADR-0003（Dictionary owner / upgrade 権限）、ADR-0004（user input 経路の復活余地検討）
