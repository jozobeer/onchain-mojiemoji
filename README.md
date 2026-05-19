# Onchain Mojiemoji

<p align="center">
  <img src="./docs/images/hero-v1.png" alt="Onchain Mojiemoji — mojiemoji URL を Ethereum 上の NFT として永続化する Dream の視覚化" width="400">
</p>

**mojiemoji の URL = 画像という性質を Ethereum に <img src="https://mojiemoji.jozo.beer/emoji/%E7%84%BC%E3%81%8D?font=akzk&color=ef4444&animation=kaiten&speed=normal&outline=darker&outline_width=2&background=transparent" alt="焼き" height="20" align="absmiddle"><img src="https://mojiemoji.jozo.beer/emoji/%E8%BE%BC%E3%82%93%E3%81%A7?font=akzk&color=ef4444&animation=kaiten&speed=normal&outline=darker&outline_width=2&background=transparent" alt="込んで" height="20" align="absmiddle"> NFT として <img src="https://mojiemoji.jozo.beer/emoji/%E6%B0%B8%E7%B6%9A%E5%8C%96?font=zero&color=a855f7&animation=yatta&speed=normal&outline=darker&outline_width=2&background=transparent" alt="永続化" height="20" align="absmiddle"> する。**

`mojiemoji.jozo.beer` は URL のクエリパラメータ（text / font / color / animation / speed）から画像を即時生成する <img src="https://mojiemoji.jozo.beer/emoji/%E3%82%B9%E3%83%86%E3%83%BC%E3%83%88?font=kurobara&color=3b82f6&animation=ekken&speed=normal&outline=darker&outline_width=2&background=transparent" alt="ステート" height="20" align="absmiddle"><img src="https://mojiemoji.jozo.beer/emoji/%E3%83%AC%E3%82%B9?font=kurobara&color=3b82f6&animation=ekken&speed=normal&outline=darker&outline_width=2&background=transparent" alt="レス" height="20" align="absmiddle"> なサービス。この **URL がそのまま画像である** という性質を、ERC-721 の `tokenURI` で <img src="https://mojiemoji.jozo.beer/emoji/%E5%8B%95%E7%9A%84?font=hachimaru&color=22c55e&animation=poyoon&speed=normal&outline=darker&outline_width=2&background=transparent" alt="動的" height="20" align="absmiddle"><img src="https://mojiemoji.jozo.beer/emoji/%E5%90%88%E6%88%90?font=hachimaru&color=22c55e&animation=poyoon&speed=normal&outline=darker&outline_width=2&background=transparent" alt="合成" height="20" align="absmiddle"> して返す。画像を IPFS / Arweave / S3 のどこにも保存しないのに、token を所有することがその mojiemoji を所有することと <img src="https://mojiemoji.jozo.beer/emoji/%E4%B8%80%E8%87%B4?font=noto-sans-jp&color=06b6d4&animation=tenmetsu&speed=normal&outline=darker&outline_width=2&background=transparent" alt="一致" height="20" align="absmiddle"> する。

## なぜ作るか

- mojiemoji の URL は、そのままで画像を表す
- だったら NFT の `tokenURI` に焼き付ければ、画像ホスティングは全部 <img src="https://mojiemoji.jozo.beer/emoji/%E4%B8%8D%E8%A6%81?font=maru-bold&color=dc2626&animation=gatagata&speed=slow&outline=darker&outline_width=2&background=transparent" alt="不要" height="20" align="absmiddle">
- Ethereum 上だけで完結する、<img src="https://mojiemoji.jozo.beer/emoji/%E3%83%94%E3%83%A5%E3%82%A2?font=chikara&color=f59e0b&animation=kira&speed=normal&outline=darker&outline_width=2&background=transparent" alt="ピュア" height="20" align="absmiddle"> にオンチェーンな絵文字 NFT が成立する
- ガス代を抑えながら **<img src="https://mojiemoji.jozo.beer/emoji/10%E4%B8%87%E5%80%8B?font=tamanegi&color=ec4899&animation=kirari&speed=normal&outline=darker&outline_width=2&background=transparent" alt="10万個" height="20" align="absmiddle"> レベルの <img src="https://mojiemoji.jozo.beer/emoji/%E3%83%90%E3%83%AA%E3%82%A8%E3%83%BC?font=toge&color=f472b6&animation=neruneru&speed=normal&outline=darker&outline_width=2&background=transparent" alt="バリエー" height="20" align="absmiddle"><img src="https://mojiemoji.jozo.beer/emoji/%E3%82%B7%E3%83%A7%E3%83%B3?font=toge&color=f472b6&animation=neruneru&speed=normal&outline=darker&outline_width=2&background=transparent" alt="ション" height="20" align="absmiddle">** を目指す

## アーキテクチャ

| 観点 | 採用 |
|---|---|
| 規格 | ERC-721 + ERC-721Psi（バッチ mint 効率） |
| 拡張 | Burnable / Upgradeable (UUPS) |
| ライセンス制御 | Operator Filter Registry |
| Mint 制御 | Merkle proof allowlist |
| Stamp.text 格納 | `bytes32` inline (Short String Optimization)、1 slot 固定 |
| 他 Param（色 / アウトライン / アニメ / 速度） | `tokenId` のハッシュから決定論的 <img src="https://mojiemoji.jozo.beer/emoji/%E6%B4%BE%E7%94%9F?font=maru&color=67e8f9&animation=mabataki&speed=slow&outline=darker&outline_width=2&background=transparent" alt="派生" height="20" align="absmiddle"> |
| `tokenURI` の URL 組み立て | オンチェーンで percent-encode + <img src="https://mojiemoji.jozo.beer/emoji/%E5%8B%95%E7%9A%84?font=hachimaru&color=22c55e&animation=poyoon&speed=normal&outline=darker&outline_width=2&background=transparent" alt="動的" height="20" align="absmiddle"><img src="https://mojiemoji.jozo.beer/emoji/%E5%90%88%E6%88%90?font=hachimaru&color=22c55e&animation=poyoon&speed=normal&outline=darker&outline_width=2&background=transparent" alt="合成" height="20" align="absmiddle">（view 関数なので gas <img src="https://mojiemoji.jozo.beer/emoji/%E7%84%A1%E6%96%99?font=rampart&color=22c55e&animation=yatta&speed=normal&outline=darker&outline_width=2&background=transparent" alt="無料" height="20" align="absmiddle">） |

詳細な技術判断は [`docs/adr/`](./docs/adr/) を参照。

## Stamp.text の制約

オンチェーン記録するのはユーザー入力の文字列のみ。それ以外の Param は全部 `tokenId` のハッシュ <img src="https://mojiemoji.jozo.beer/emoji/%E6%B4%BE%E7%94%9F?font=maru&color=67e8f9&animation=mabataki&speed=slow&outline=darker&outline_width=2&background=transparent" alt="派生" height="20" align="absmiddle"> で生成する。

- 漢字 1〜2 文字
- ひらがな 1〜4 文字
- 改行 `\n` 1 個まで可（2 文字 + 改行 + 2 文字のパターン可）
- UTF-8 最大 13 bytes（`bytes32` 1 slot に <img src="https://mojiemoji.jozo.beer/emoji/%E4%BD%99%E8%A3%95?font=gothic-bold&color=4ade80&animation=mochimochi&speed=slow&outline=darker&outline_width=2&background=transparent" alt="余裕" height="20" align="absmiddle"> で収まる）

## Quick Start

```shell
npm install --legacy-peer-deps
npx hardhat compile
npx hardhat test
npx hardhat coverage
```

主なタスク：

```shell
npx hardhat accounts
npx hardhat node
npx hardhat run scripts/deploy.ts
REPORT_GAS=true npx hardhat test
npx eslint '**/*.{js,ts}' --fix
npx solhint 'contracts/**/*.sol' --fix
```

## 開発ルール

- **TDD**：先にテスト（`tdd-spec`）が <img src="https://mojiemoji.jozo.beer/emoji/%E5%BF%85%E9%A0%88?font=maru-bold&color=93c5fd&animation=zanzo&speed=normal&outline=darker&outline_width=2&background=transparent" alt="必須" height="20" align="absmiddle">、あとから実装（`tdd-impl`）
- **テスト = <img src="https://mojiemoji.jozo.beer/emoji/%E4%BB%95%E6%A7%98?font=noto&color=f97316&animation=tate_ekken&speed=normal&outline=darker&outline_width=2&background=transparent" alt="仕様" height="20" align="absmiddle">**。 <img src="https://mojiemoji.jozo.beer/emoji/%E5%AE%89%E6%98%93?font=gothic&color=fca5a5&animation=psycho&speed=fast&outline=darker&outline_width=2&background=transparent" alt="安易" height="20" align="absmiddle"> に書き換えない
- **強制 unwrap <img src="https://mojiemoji.jozo.beer/emoji/%E7%A6%81%E6%AD%A2?font=mincho&color=ef4444&animation=bure&speed=normal&outline=darker&outline_width=2&background=transparent" alt="禁止" height="20" align="absmiddle">**（TS の `!`、Solidity の require 削除など）
- **カバレッジ 95% 以上**（Domain / DI / Orchestrator は除外）
- 詳細は [`.claude/CLAUDE.md`](./.claude/CLAUDE.md) を参照

## License

Copyright (c) 2024 Yumenosuke Kokata
