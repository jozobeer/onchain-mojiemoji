# ADR-0005: image URL を `/emoji/` 形へ修正し、Stamp Param を tokenId ハッシュから決定論的に派生

- 採択日: 2026-06-05
- ステータス: Accepted
- 関係者: jozobeer
- 関連: ADR-0001（Dream tokenURI 仕様 — URL 形式と「他 Param は別 ADR で」条項を **本 ADR が supersede / 履行**）/ ADR-0002（Upgradeable Dictionary — word 選択は不変）/ ADR-0004（on-chain JSON metadata — image フィールド埋め込み経路）

## Context（背景）

### バグ: `image` が画像ではなく HTML を返す

ADR-0004 で `tokenURI` / `contractURI` は OpenSea 標準の on-chain JSON metadata（`data:application/json;base64,...`）を返すようにした。その JSON の `image` フィールドには mojiemoji URL を埋め込んでいるが、形式が

```
https://mojiemoji.jozo.beer/?text=<percentEncode(word)>
```

になっている。この `/?text=` 経路は mojiemoji の **SPA シェル（HTML）** を返すため、marketplace / wallet が `image` を fetch すると `Content-Type: text/html` が返り、**NFT 画像が表示されない**。

```
$ curl -sI 'https://mojiemoji.jozo.beer/?text=…'        → content-type: text/html
$ curl -sI 'https://mojiemoji.jozo.beer/emoji/…?font=…' → content-type: image/gif
```

実画像を返す canonical 形は `/emoji/<text>?font=&color=&animation=&speed=` である。皮肉なことに ADR-0001 本文に貼られた mojiemoji スタンプ自体がこの `/emoji/` 形を使っており、canonical 形は当初から `/emoji/` だった。バグは ADR-0001 の Decision §1（コード例 L33）が旧 `/?text=` 形を spec として書き、ADR-0004 がそれを踏襲したことに由来する。ADR-0001 Cons L82「`mojiemoji.jozo.beer` 側の URL 仕様変更時は contract upgrade が必要」が、まさにこの形でヒットした。

### 未実装の Dream 条項

ADR-0001 §1 は次を宣言した:

> 他 Param（色 / アウトライン / アニメ / 速度）は `tokenId` のハッシュから決定論的に派生させ、最大 10 万バリエーションを目指す（**詳細は別 ADR で**）。

しかしこの「別 ADR」は書かれないまま残った（後続予定だった ADR-0002 は Upgradeable Dictionary に化けた）。結果として現行 `tokenURI` の URL には Param が一切付かず、全 token が同一スタイル（mojiemoji のデフォルト）でレンダーされている。**本 ADR がこの未実装条項を履行する。**

## Decision（決定）

### D1: image URL を `/emoji/` 形へ

```
https://mojiemoji.jozo.beer/emoji/<percentEncode(word)>?font=<f>&color=<c>&animation=<a>&speed=<s>
```

- word は path segment に置き、既存の `_percentEncode`（RFC 3986 unreserved 以外を %XX 化）で encode する。path segment でも query 同様に安全。
- Param 値（font / color / animation / speed）は全て ASCII の固定語彙（小文字英字・数字・`-`・`_`・hex）で、いずれも RFC 3986 unreserved もしくは URL-safe。**追加の percent-encode 不要**でリテラル埋め込みする。

### D2: Param 派生スキーム（pure / upgrade-safe）

```solidity
bytes32 private constant _PARAM_SALT = "EMJ_PARAM_V1";

// ph = domain-separated param hash（word 選択の keccak とは別ドメイン）
uint256 ph = uint256(keccak256(abi.encode(_PARAM_SALT, tokenId)));
```

- **tokenId のみの pure 関数**。Dictionary にも storage にも一切依存しない → 新規 storage slot ゼロ。state を一切増やさないため storage layout はバイト単位で不変。`upgrades.validateImplementation`（transparent）で実測確認済みで、layout 不変性は「新規 state 無し」という構造的事実によるため **proxy 種別に依存しない**（measurement は transparent のみ。kind 非依存は測定ではなく構造的帰結）。
- word 選択は従来どおり `keccak256(abi.encode(tokenId)) % range`（ADR-0002、不変）。salt によって **word ドメインと param ドメインを分離**し、両者の相関を断つ。
- salt のバージョン接尾辞 `_V1` は、将来 param 体系を作り直したくなった際に新 salt（`_V2`）へ切り替えるための余地（その時は新 ADR）。

### D3: 候補集合とビット切り出し

候補集合のサイズを全て **2 の冪** にすることで、ビットマスクだけで **modulo bias なしの一様分布**が得られる（マスク値がちょうど配列長を覆い、out-of-bounds revert も原理的に発生しない）。

| Param     | 候補数 | bits | shift | 抽出式              |
| --------- | ------ | ---- | ----- | ------------------- |
| font      | 16     | 4    | 0     | `ph & 0xF`          |
| color     | 64     | 6    | 4     | `(ph >> 4) & 0x3F`  |
| animation | 32     | 5    | 10    | `(ph >> 10) & 0x1F` |
| speed     | 4      | 2    | 15    | `(ph >> 15) & 0x3`  |

消費 17 bit / 256 bit。組み合わせ数 = 16 × 64 × 32 × 4 = **131,072 通り**（Param だけで 10 万超 — ADR-0001「最大 10 万バリエーション」を Param 単独で満たす）。word 選択を掛ければさらに広い。

候補集合（全て live endpoint `/emoji/` で `Content-Type: image/*` を実証済み。**invalid font は 400 を返し画像が壊れるため、font 名は厳密一致が必須**。invalid animation は silent static にフォールバックするだけ）:

- **fonts (16)**: `gothic, gothic-bold, maru, maru-bold, mincho, dela, akzk, zero, kurobara, hachimaru, chikara, tamanegi, pixel, toge, rampart, noto`
  （canonical 17 から `noto-sans-jp` を除外 — `noto` と近重複）
- **colors (64)**: HSL スイープ（16 hue × 4 明度/彩度帯）で生成した dark-mode-safe な 6-hex 64 色（重複なし）。一覧は `libraries/stampParams.ts` を single source of truth とする。
- **animations (32)**: canonical 34 から `bakusan`（spec が block-only と明記、letterform を潰す）と `kirari`（`kira` と近重複）を除外:
  `tate_scroll, yoko_scroll, ekken, tate_ekken, bane, gatagata, bure, chuuou_zoom, kira, tenmetsu, shuchusen, kaiten, neruneru, patapata, yurayura, mabataki, norinori, mochimochi, mozaiku, poyoon, yatta, tatemoya, nami, yokomoya, zairu, zanzo, chirichiri, disco, psycho, kage_kaiten, kage_bokashi, kage_neon`
- **speeds (4)**: `step, slow, normal, fast`

### D4: ADR-0001 の `outline` → `font` 置換

ADR-0001 は派生 Param を「色 / アウトライン / アニメ / 速度」と挙げたが、本 ADR は **outline を font に差し替える**。理由:

- font は文字の構造そのものを変える → outline 色より遥かに視覚的多様性が大きい
- outline は GitHub 背景に対する可読性 polish の概念で、単体表示の NFT 画像には本質的でない
- font / color / animation / speed が mojiemoji の主要 4 軸

NFT 画像にはデフォルト背景・デフォルト outline をそのまま使い、URL を最小に保つ（`background` / `outline` Param は付与しない）。

### D5: `contractURI` は curated 固定 Param

collection には tokenId が無いため派生できない。branding として手選びした固定 Param を使う:

```
https://mojiemoji.jozo.beer/emoji/<percentEncode("絵")>?font=dela&color=f59e0b&animation=kira&speed=normal
```

代表 word `"絵"`（ADR-0004 D2）は不変。

### D6: 実装配置

派生ロジックと候補集合は **`contracts/StampParams.sol`（library, internal pure）** に分離する。EMJ.sol は既に 859 行と肥大しており、Param 語彙という凝集した spec データを独立 library に置く方がドメイン表現として整然で、単体テストも容易。公開 API は `StampParams.paramQuery(tokenId) → "?font=...&color=...&animation=...&speed="` の 1 本（クエリ文字列を直接返す）で、`tokenURI` はこれを `https://mojiemoji.jozo.beer/emoji/<word>` に連結するだけ。`contractURI` は tokenId を持たないため library は呼ばず、D5 の固定クエリをハードコードする。coverage 除外設定は無いため StampParams も被覆対象（tokenURI 経由の統合テストで全関数を駆動する。実測 100%）。

TS 側は **`libraries/stampParams.ts`** に同じ候補集合と、Solidity とは独立に再実装した JS oracle `deriveStampParams(tokenId)` / `stampImageUrl(word, tokenId)` を置き、テスト oracle と smoke script で共用する。

## Consequences（結果）

### Pros

- **画像表示復旧**: `image` が `image/*` を返す URL になり OpenSea / wallet で表示される（Dream「URL = 画像」が実際に成立）
- **Dream 条項の履行**: ADR-0001 が別 ADR に先送りした Param 派生を実装、131,072 通りの見た目
- **upgrade-safe**: 定数 + pure 関数のみ、新規 storage slot ゼロ → OZ Upgrades の layout 検証に影響なし
- **一様分布 / no bias**: 2 冪候補集合 + ビットマスクで modulo bias なし、out-of-bounds revert 不能
- **決定論的 & Dictionary 非依存**: 同一 tokenId は永久に同一 Param。word を変えても Param は不変（ドメイン分離）

### Cons

- **gas / bytecode 増**: 候補集合の string 配列を view 内で組むコストが増える（view なので on-chain caller は払わない）。bytecode は library 分増えるが EMJ 本体からは分離
- **mojiemoji URL 仕様への依存継続**: ADR-0001 Cons と同じく、`/emoji/` 形や Param 名が将来変わると upgrade が必要。candidate を live endpoint で実証済みなことで現時点のリスクは最小化
- **既存テストの supersede**: 下記 3 テストの URL 期待値（旧 `/?text=` 形）は本 ADR で正式に supersede し更新する（「テスト = 仕様、安易に変えない」の例外を ADR で承認）

### 影響範囲

| ファイル                                  | 変更                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `docs/adr/0005-stamp-param-derivation.md` | 本 ADR 新規                                                                                         |
| `libraries/stampParams.ts`                | 候補集合 + 独立 JS oracle（新規）                                                                   |
| `contracts/StampParams.sol`               | 派生 library（新規）                                                                                |
| `contracts/EMJ.sol`                       | `tokenURI` / `contractURI` の URL 組み立てを `/emoji/` + 派生 Param へ                              |
| `test/testEMJTokenURIDictionary.ts`       | URL 期待値を `/emoji/` + 派生 Param 形へ（snapshot/aliasing/percent-encode 等の他カバレッジは保持） |
| `test/testEMJTokenURIMetadata.ts`         | `image` の正規表現と word 抽出を path segment ベースへ                                              |
| `test/testEMJContractURI.ts`              | `image` 期待値を curated `/emoji/` 形へ                                                             |
| `test/testEMJStampParams.ts`              | 派生の専用テスト（新規）— 各マスク独立検証 / 決定論 / Dictionary 非依存 / 固定 tokenId サンプル pin |
| `scripts/smoke-onchain-json.ts`           | 実 image URL を curl して `image/*` を assert                                                       |

### マイグレーション

- proxy upgrade で実装差し替えのみ。新規 state を追加しないため storage layout は不変で、`upgrades.validateImplementation`（transparent）で実測確認済み。layout 不変性は新規 state ゼロという構造的事実によるため proxy 種別に依存しない。
- 既存 token の `image` URL 文字列が変わる（`/?text=` → `/emoji/?…`）。marketplace 側 cache の更新を待つ必要あり。

## 関連

- ADR-0001 §1「他 Param は別 ADR で」/ Cons L82「URL 仕様変更時は upgrade」 — 本 ADR が履行 & 的中の修正
- ADR-0002: word 選択（`keccak256(abi.encode(tokenId)) % range`）は不変。本 ADR は salt 付き別ドメインで Param のみ派生
- ADR-0004: on-chain JSON metadata の `image` フィールド埋め込み経路（不変、中身の URL 形のみ変更）
- 参考: [mojiemoji parameters](../../.claude/skills/mojiemoji-github/references/parameters.md) — canonical font/animation/speed/color
