# ADR-0004: tokenURI / contractURI を data:application/json;base64 の OpenSea 標準 metadata 形式に変更

- 採択日: 2026-05-22
- ステータス: Accepted
- 関係者: jozobeer
- 関連: ADR-0001（Dream tokenURI 仕様）/ ADR-0002（Upgradeable Dictionary）/ ADR-0003（Dictionary freeze）/ Issue #28 / 参考: [BingoNFT BNGVer0.sol](https://github.com/GeneralD/BingoNFT/blob/main/contracts/BNGVer0.sol)

## Context（背景）

ADR-0001 / ADR-0002 で `tokenURI(tokenId)` は Dictionary 経由で word を派生して mojiemoji.jozo.beer の URL を**直接**返す仕様にした。`contractURI()` は scaffold 時点から `baseURI + "index.json"` の外部 URL を返している。

この経路で動作はするが、OpenSea / LooksRare / X2Y2 などの標準 NFT marketplace は tokenURI / contractURI に対して **`data:application/json;base64,...` 形式の on-chain JSON metadata** を期待する形が de-facto standard になっており、外部 URL を単独で返す形は marketplace 側で fallback parsing に入って正しく表示されないケースが多い。具体的には marketplace は以下を読みたい：

- `name` / `description` / `image` (token-level)
- `attributes[]` (trait_type / value のペア)
- `external_link` / `seller_fee_basis_points` / `fee_recipient` (collection-level)

mojiemoji.jozo.beer の URL は「URL = 画像」という Dream の核なので、これを **JSON metadata の `image` フィールドに格納**して、JSON 自体は contract 内で組み立て base64 encode して返せば：

- Dream「URL = 画像」は維持（image フィールドに mojiemoji URL）
- marketplace 標準準拠（OpenSea 表示 OK）
- IPFS / Arweave なしで完全 on-chain（Dream「永続化」と整合）

参考実装の [BingoNFT BNGVer0.sol](https://github.com/GeneralD/BingoNFT/blob/main/contracts/BNGVer0.sol) は同じパターンを採用しているが、image を SVG として on-chain 生成している点が異なる。本リポは image を外部 mojiemoji URL に逃がす Dream なので、JSON 構築部分のみ参考にする。

## Decision（決定）

### tokenURI

```solidity
function tokenURI(uint256 tokenId) public view override checkTokenIdExists(tokenId) returns (string memory) {
    uint256 batchStart = _getBatchHead(tokenId);
    uint256 range = _wordSnapshotAtBatchStart[batchStart];
    uint256 idx = uint256(keccak256(abi.encode(tokenId))) % range;
    bytes memory text = dictionary.wordAt(idx);
    string memory imageUrl = string(abi.encodePacked("https://mojiemoji.jozo.beer/?text=", _percentEncode(text)));
    bytes memory json = abi.encodePacked(
        '{"name":"Onchain Mojiemoji #', tokenId.toString(),
        '","description":"',  _DESCRIPTION_TOKEN,
        '","image":"', imageUrl,
        '","attributes":[{"trait_type":"word","value":"', text, '"}]}'
    );
    return string(abi.encodePacked("data:application/json;base64,", Base64Upgradeable.encode(json)));
}
```

### contractURI

```solidity
bytes private constant _CONTRACT_IMAGE_WORD = bytes(unicode"絵");

function contractURI() public view returns (string memory) {
    string memory imageUrl = string(abi.encodePacked(
        "https://mojiemoji.jozo.beer/?text=", _percentEncode(_CONTRACT_IMAGE_WORD)
    ));
    bytes memory json = abi.encodePacked(
        '{"name":"Onchain Mojiemoji"',
        ',"description":"', _DESCRIPTION_COLLECTION,
        '","image":"', imageUrl,
        '","external_link":"https://mojiemoji.jozo.beer/"',
        ',"seller_fee_basis_points":', uint256(_royaltyFraction).toString(),
        ',"fee_recipient":"', Strings.toHexString(_royaltyReceiver),
        '"}'
    );
    return string(abi.encodePacked("data:application/json;base64,", Base64Upgradeable.encode(json)));
}
```

### Decision Point 確定

#### D1: `baseURI` storage slot の扱い → 案 (a) を採用

`baseURI` (string public) / `setBaseURI` / `_baseURI()` / `checkSuffix` modifier は**完全に維持**する。理由:

- UUPS storage layout 互換性が壊れない（最も安全）
- ERC721 metadata extension 系の tooling (etherscan の標準 ABI 検査など) が `setBaseURI` を呼んでも例外で死なない
- `contractURI` が baseURI を読まなくなるので `baseURI` は dead state になるが、書き込みは依然可能（無害）
- 将来「やっぱり外部 URL に戻したい」となった場合の選択肢を奪わない

storage slot ごと残すコストは 1 slot 分の dead state のみ。`setBaseURI` を no-op / revert にすると ERC721 標準互換 tooling が壊れる可能性があり、利得に対してリスクが大きい。

NatSpec で「contractURI からは読まれない、ADR-0001 時代の遺物」と明記する。

#### D2: `contractURI` の image 用「代表 word」→ 案 (a) ハードコード `"絵"` を採用

選択肢を再評価:

| 案 | 評価 |
|---|---|
| (a) hardcoded `"絵"` (bytecode に焼く) | **採用**。簡潔・Dictionary 非依存・branding として thematic (絵 ≒ 絵文字 ≒ mojiemoji) |
| (b) deploy-time setter | storage 1 slot 追加が必要（layout 影響）、運用の事故余地が増える |
| (c) Dictionary index 0 | `contractURI` が Dictionary set 前は revert → marketplace の collection page が読めなくなる時期がある |

ハードコードのデメリットは「将来変えたくなったら implementation upgrade が必要」だが、ADR-0003 `freeze()` が EMJ 側にはまだ無く、必要なら upgrade 可能。逆に branding word が頻繁に変わる想定はなく、固定で問題ない。

### Base64 encoding 実装

OpenZeppelin contracts-upgradeable v4.9.6 が提供する `Base64Upgradeable.encode(bytes memory)` を使う。標準実装で、gas 効率も枯れているので独自実装はしない。

```solidity
import { Base64Upgradeable } from "@openzeppelin/contracts-upgradeable/utils/Base64Upgradeable.sol";
```

## Consequences（結果）

### Pros

- **marketplace 標準準拠**: OpenSea / LooksRare 等で collection / token metadata が正しく表示される
- **on-chain 完結**: IPFS / Arweave 不要、Dream「永続化」と整合
- **Dream「URL = 画像」維持**: mojiemoji URL は `image` フィールドに格納されて生きる
- **attributes 拡張余地**: 将来 `font` / `color` 等の Param を attributes に追加できる土台ができる
- **storage layout 安全**: baseURI 系を残すので UUPS upgrade 互換性に変更なし

### Cons

- **gas 増分**: base64 encode のループが tokenURI 呼び出しごとに走る。ただし view 関数なので on-chain caller は通常いない (server-side コスト)
- **bytecode 増加**: Base64Upgradeable import + JSON 文字列リテラルで contract size が増える (推定 +2-3KB)
- **dead state**: baseURI slot が永続的に dead（無害だが冗長）
- **branding word 固定**: contractURI image の "絵" を変えたい場合 upgrade 必須

### 影響範囲

| ファイル | 変更 |
|---|---|
| `contracts/EMJ.sol` | tokenURI / contractURI 書き換え、Base64Upgradeable import 追加 |
| `test/testEMJTokenURIDictionary.ts` | 既存テストの URL 期待値を JSON metadata 検証に書き換え (または削除し新規ファイル化) |
| `test/testEMJContractURI.ts` | `baseURI + "index.json"` 前提を JSON metadata 検証に書き換え |
| `test/testEMJBaseURI.ts` | `setBaseURI propagates to contractURI` のテスト1件削除、他は維持 |
| `docs/adr/0004-onchain-json-metadata.md` | 本 ADR 新規作成 |

### マイグレーション

- UUPS proxy upgrade で実装差し替えのみ。storage layout 不変なので OZ Upgrades plugin の `validateUpgrade` が通る
- 既存 token の tokenURI / contractURI 文字列値が変わる（外部 URL → data: URI）。marketplace 側 cache の更新を待つ必要あり

## 関連

- Issue #28（本 ADR が close するトリガー）
- ADR-0001 §「捨てたパターン」: IPFS / Arweave 不要 → on-chain JSON で完全に on-chain 化する形に進化
- ADR-0002: Dictionary 経由 word 派生（変更なし、本 ADR は image フィールドへの埋め込み経路を追加するのみ）
- ADR-0003: Dictionary freeze（変更なし）
- 参考: [BingoNFT BNGVer0.sol](https://github.com/GeneralD/BingoNFT/blob/main/contracts/BNGVer0.sol) — on-chain JSON metadata pattern
- 参考: [OpenSea metadata standards](https://docs.opensea.io/docs/metadata-standards)
