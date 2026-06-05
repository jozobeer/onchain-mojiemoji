# ADR-0006: EMJ を Transparent proxy として確定（UUPS は EIP-170 バイトコード上限と locked test の二重の壁で却下）

- 採択日: 2026-06-06
- ステータス: Accepted
- 関係者: jozobeer
- 関連: Issue #36（本 ADR が close するトリガー）/ ADR-0002 §3（Dictionary を UUPS と決定 — EMJ の proxy 種別は本 ADR で確定）/ ADR-0005 §D2・マイグレーション（storage layout 不変性は proxy 種別非依存という構造的帰結を確立）

## Context（背景）

### 発端: proxy 種別の「記述」と「配線」の食い違い（#36）

#35 の作業中に、EMJ の proxy 種別がコード/ドキュメントと deploy 配線で食い違っていることが判明した。

- **配線は全経路 Transparent**: EMJ の `deployProxy` 呼び出しは全 6 経路（`scripts/deploy.ts` / `scripts/smoke-onchain-json.ts` / `libraries/const.ts` / `test/testEMJStampParams.ts` / `testEMJTokenURIMetadata.ts` / `testEMJTokenURIDictionary.ts`）で `kind` オプションを渡していない。`hardhat.config.ts` にグローバル既定の上書きもない。OZ Upgrades は impl が `upgradeTo`/`upgradeToAndCall` を露出しなければ **Transparent** に分類する（`upgrades-core` の `inferProxyKind`）。
- **記述の多くは UUPS**: 一方でコメント・ADR・README・smoke スクリプトは EMJ を「UUPS」と呼ぶ箇所が多数あった（カタログは §D4 と #36）。
- **EMJ は構造的に UUPS になり得ない**: `contracts/EMJ.sol` は `UUPSUpgradeable` を継承しておらず、`_authorizeUpgrade` / `upgradeTo` / `upgradeToAndCall` / `proxiableUUID` をどれも持たない。`kind: "uups"` を明示すると OZ validation が _missing public upgradeTo... Inherit UUPSUpgradeable_ で失敗する。
- **対照: Dictionary は本物の UUPS**: `contracts/Dictionary.sol` は `UUPSUpgradeable` 継承・`__UUPSUpgradeable_init()`・`_authorizeUpgrade(address) internal override onlyOwner`（freeze 時 revert）を備え、全 deploy が `{ kind: "uups" }` を明示。**EMJ と Dictionary で扱いが意図的に異なる**ことは裏取り済み。
- **追跡された本番 deploy は存在しない**: リポに `.openzeppelin/` manifest が無く、`mainnet.json` / `sepolia.json` は git 履歴にも存在しない。mint 済み token も無い。つまり**今は本番に出る前**で、どちらの方向にも安価に確定できる。

論点は資金リスクや機能破綻ではなく（アップグレード自体は ProxyAdmin 経由で機能する）、「**意図 × ガバナンスモデル × ドキュメントの不一致**」である。本 ADR はこれを **Transparent で確定**し、UUPS を却下した根拠を測定値とともに記録する。

## Decision（決定）

### D1: EMJ は Transparent proxy で確定する

EMJ は Transparent proxy として deploy・運用する。これは「既にそう配線されているから」ではなく、§D2 の測定と §D3 のガバナンス分析を経た**意図的な選択**である。Dictionary が UUPS であることとは独立に決定する（両者で proxy 種別が異なるのは意図どおり）。

### D2: UUPS を却下した根拠（EIP-170 測定 + locked test カスケード）

EMJ に `UUPSUpgradeable` を継承させる「真の UUPS 化」は、以下の二重の壁で却下する。

#### 壁 1: EIP-170（24,576 byte の deployed-bytecode 上限）

EMJ に `UUPSUpgradeable` 継承 + `__UUPSUpgradeable_init()` + `_authorizeUpgrade(address) internal override onlyOwner {}` を加え、コンパイル設定を変えながら EMJ の deployed bytecode を実測した（Solidity 0.8.25, evm target paris）:

| コンパイル設定                             | EMJ deployed bytecode | EIP-170 (24576) に対して |
| ------------------------------------------ | --------------------- | ------------------------ |
| Transparent baseline（runs:200, 現状）     | 24,110 B              | ✅ 466 B headroom        |
| UUPS naive（runs:200）                     | 26,171 B              | ❌ 1,595 B 超過          |
| UUPS（runs:1）                             | 25,792 B              | ❌ 1,216 B 超過          |
| UUPS + `revertStrings:"strip"`（runs:200） | 22,271 B              | ✅ 2,305 B headroom      |

naive な UUPS 化は EIP-170 を 1,595 B 超過し、**mainnet にデプロイできない**（コンパイラ自身が警告を出す）。`optimizer.runs` を 1 まで下げても 25,792 B で 1,216 B 超過のままで、かつ全 contract の runtime gas を犠牲にする。

UUPS を上限内に収める唯一の手段が `revertStrings: "strip"`（22,271 B で収まる）だが、これは**全 contract の revert reason string を一律に消す**設定である。

#### 壁 2: revert string を消すと locked test が全滅する（カスケード）

`revertStrings:"strip"` も、もう一つの縮小手段である **custom errors 化**も、結局は revert reason string を消す/変える。そして本リポのテストは仕様であり、安易に変えない（`.claude/CLAUDE.md`「テスト = 仕様」）。

- テストは `revertedWith("...")` で**正確な revert メッセージ文字列**に assert しており、全 35 箇所（うち EMJ 系 9 ファイルに 28 箇所）。例: `"Ownable: caller is not the owner"`（4）/ `"tokenId not exist"`（5）/ `"upgrades frozen"`（2）/ `"allowlist minting exceeds the limit"`（2）など。
- `revertStrings:"strip"` を入れると revert メッセージが空になり、この 35 assertion が**全て fail**する。通すには locked test を ADR 承認付きで書き換えるカスケードが発生する。
- custom errors 化も同様: `revertedWith(string)` を `revertedWithCustomError(...)` へ書き換える必要があり、同じ 35 assertion カスケードに落ちる。

#### 残る手段とその却下

- **metadata synthesis library 抽出**で EMJ 本体から ~1.6KB を切り出せば revert string を保ったまま UUPS 化できる可能性はある。が、これは Dream の中核である `tokenURI` 動的合成に手を入れ、delegatecall / library linking のリスクを新たに負う。得られる利得（後述）に対して不釣り合い。

#### なぜ却下が妥当か

真の UUPS が買う唯一の本質的価値は「**アップグレード権限が単一ロール（owner）に集約される**」ことだが、この性質は §D3 のとおり **Transparent でも運用で実現できる**。UUPS のコスト（revert string 喪失・locked test カスケード・あるいは Dream 中核への refactor risk）を一切払わずに、同じガバナンス性質を得られる。したがって UUPS は却下する。

### D3: アップグレード権限 = ProxyAdmin の owner（運用 runbook）

Transparent proxy ではアップグレード権限が EMJ 本体ではなく、`deployProxy` が生成する別 contract **ProxyAdmin の owner** にある。EMJ 自身の `Ownable2Step` owner は mint / withdraw 等の機能管理者であって、アップグレード実行者**ではない**（UUPS なら両者が一致する。Dictionary はその形）。

この 2 ロール分裂を運用で埋めるための規律（deploy 時だけでなく**継続的な義務**）:

1. **deploy 時**: ProxyAdmin の owner を、EMJ の `Ownable2Step` owner と**同一の multisig** に設定する。
2. **ownership rotation 時**: EMJ owner と ProxyAdmin owner は**必ず同時に**移管する。片方だけ移すと、アップグレード権限が旧 owner に取り残される（#36 が severity 高と評価したトラップ）。
3. アップグレード実行は `scripts/upgrade.ts` の `upgrades.upgradeProxy(...)`（ProxyAdmin 経由）で機能する（既に配線済み）。

これにより UUPS の「owner == upgrader」性質を Transparent でも実現する。

### D4: ドキュメント訂正（doc-only change surface）

EMJ を UUPS と誤ラベルしている箇所を全て訂正する。storage layout 規律（新規 state は末尾 append）は proxy 種別に依存しない構造的帰結（ADR-0005）なので、コメント中の「UUPS」は「Transparent」または kind 非依存表現に直すだけで、**規律そのものは不変**。

| file:line                         | 訂正内容                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `contracts/EMJ.sol:201`           | `UUPS storage layout compatibility` → proxy 種別非依存の表現へ                 |
| `contracts/EMJ.sol:786`           | `this contract is upgradeable (UUPS proxy)` → `(Transparent proxy — ADR-0006)` |
| `README.md:27`                    | `Upgradeable (UUPS)` → `Upgradeable (Transparent proxy)`                       |
| `docs/adr/0002:61,64`             | EMJ=UUPS 記述を訂正（Dictionary の UUPS 記述は正しいので維持）                 |
| `docs/adr/0004:75,112,133`        | EMJ 文脈の UUPS を proxy / Transparent へ訂正                                  |
| `scripts/smoke-onchain-json.ts:3` | コメント `deploys ... EMJ as UUPS` を訂正                                      |

deploy / const / test の `deployProxy` 呼び出しは `kind` 無指定のまま（既に Transparent 配線で正しい）→ **コード変更なし**。

## Consequences（結果）

### Pros

- **ゼロ contract risk**: 既存 Transparent 配線をそのまま正式採用。bytecode は 24,110 B で EIP-170 内（466 B headroom）。実装・テスト・配線は無改変。
- **revert reason string 維持**: integrator / marketplace の error UX を温存。35 の locked test も無改変。
- **doc-only**: 変更面はコメント / ADR / README のラベルのみ。
- **配線一貫**: 全 deploy 経路が既に Transparent で一致している実態に、記述を合わせる。

### Cons（Transparent を選ぶことで手放すもの — 正直に）

本決定はトレードオフであり、UUPS なら得られたものを意図的に手放す:

- **アップグレード権限が 2 ロールに分裂する**: ProxyAdmin owner ≠ EMJ の `Ownable2Step` owner。UUPS なら 1 ロールに集約できた（Dictionary はその形）。#36 はこの分裂を severity 高と評価。
- **継続的な運用義務**: §D3 の「両ロール同時移管」を deploy 後もずっと守る必要がある。同一 multisig 運用が mitigation だが、これは deploy-time の一回設定ではなく**規律依存の継続義務**。怠るとアップグレード権限が取り残される。
- **後から UUPS 化は不可**: 稼働中の Transparent proxy を UUPS へ「アップグレードで変換」することはできない。真の UUPS 化 = 新規 proxy + token 移行 ≒ リローンチ。だから**本番に出る前の今**確定するのが最も安い。
- **薄い headroom**: 466 B しか余裕がない。将来 EMJ に機能を足すと、proxy 種別と無関係に EIP-170 対策（metadata library 抽出など）が必要になり得る。

### 影響範囲

| ファイル                                  | 変更                                                        |
| ----------------------------------------- | ----------------------------------------------------------- |
| `docs/adr/0006-emj-transparent-proxy.md`  | 本 ADR 新規                                                 |
| `contracts/EMJ.sol`                       | コメント 2 箇所（L201 / L786）の UUPS ラベル訂正のみ        |
| `README.md`                               | アーキ表 L27 の `(UUPS)` → `(Transparent proxy)`            |
| `docs/adr/0002-upgradeable-dictionary.md` | L61 / L64 の EMJ=UUPS 記述訂正（Dictionary の UUPS は維持） |
| `docs/adr/0004-onchain-json-metadata.md`  | L75 / L112 / L133 の EMJ 文脈 UUPS を訂正                   |
| `scripts/smoke-onchain-json.ts`           | L3 コメント訂正                                             |

`contracts/EMJ.sol` の実装・全 `deployProxy` 呼び出し・テストは無改変。

## Alternatives Considered（検討した代替案）

| 案                                       | 不採用理由                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (A) 真の UUPS 化                         | EIP-170 超過（naive 26,171 / runs:1 25,792 > 24,576）。収める唯一の手段 `revertStrings:"strip"` は 35 の locked revert-string test を全滅させ ADR-gated 改変カスケードを起こす。custom errors 化も同カスケード。metadata library 抽出は Dream 中核 `tokenURI` に手を入れ delegatecall/linking risk。得られる「owner=upgrader」は §D3 で Transparent でも実現可能 |
| optimizer runs を下げて UUPS を縮める    | runs:1 でも 25,792 B で 1,216 B 超過。かつ全 contract の runtime gas が悪化                                                                                                                                                                                                                                                                                      |
| `revertStrings:"strip"` を入れて UUPS 化 | UUPS は 22,271 B で収まるが、全 contract の revert reason string が消え integrator error UX が劣化、かつ locked test 35 箇所が全滅                                                                                                                                                                                                                               |

## 関連

- Issue #36 — proxy 種別の食い違いを surface したトリガー。本 ADR が close する
- ADR-0002 §3 — Dictionary を UUPS Upgradeable と決定（EMJ は別 contract。本 ADR で EMJ を Transparent と確定）
- ADR-0005 §D2・マイグレーション — storage layout 不変性は proxy 種別非依存という構造的帰結（measurement は transparent のみ）。本 ADR はその「transparent」を正式な設計判断として記録する
- [OpenZeppelin Upgrades: Transparent vs UUPS Proxies](https://docs.openzeppelin.com/contracts/4.x/api/proxy) — proxy パターンのリファレンス
