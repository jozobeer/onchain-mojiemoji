# ADR-0003: Dictionary の append-only invariant を `freeze()` で契約レベルに固定

- 採択日: 2026-05-22
- ステータス: Accepted
- 関係者: jozobeer
- 関連: ADR-0002（Upgradeable Dictionary）/ Issue #21 / Codex P1 review on PR #20

## Context（背景）

ADR-0002 で Dictionary は UUPS upgradeable contract として実装した。`Dictionary.sol` は現在の ABI に `setWord` / `removeWord` 等の mutator を持たず、現実装に限れば「append-only」不変条件は成立する。

しかし `_authorizeUpgrade` が `onlyOwner` である限り、owner は以下が可能：

1. mutator を追加した新 implementation をデプロイ
2. `upgradeTo(newImpl)` で proxy を新 implementation に切替
3. 過去 index の単語を上書きして tokenURI 派生を変える

これは Dream「mojiemoji を Ethereum に焼き込んで NFT として永続化する」と直接矛盾する。owner（または owner キーを掌握した攻撃者）が運用後に過去 token のメタデータを書き換えられる状態を放置すると、「永続化」の信頼性が contract レベルでは成立せず、運用主体への信頼に縮退する。

ADR-0002 §10 で「owner 権限の縮減は別 ADR で扱う」と先送りしていた点を、本 ADR で確定する。

## Decision（決定）

Dictionary に **one-way kill switch** `freeze()` を実装する。freeze 後は `_authorizeUpgrade` が常に revert し、以後一切の implementation 差し替えが不可能になる。

```solidity
event UpgradesFrozen();

bool public frozen;

function freeze() external onlyOwner {
    require(!frozen, "already frozen");
    frozen = true;
    emit UpgradesFrozen();
}

function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
    require(!frozen, "upgrades frozen");
}
```

### 運用フロー

| Phase | freeze 状態 | upgrade 可否 | 用途 |
|---|---|---|---|
| Phase 1: 初期語彙確定前 | false | 可 | 単語追加 / 仕様微調整 / bug fix |
| Phase 2: 初期語彙確定 + 安定確認後 | false → true | 不可（永続化） | 「永続化」の契約レベル保証 |

freeze を一度実行すると後戻りはできない（unfreezeする関数は意図的に持たない）。これは "最強の保証" を取る代わりに upgrade 機構自体を放棄する選択。

### Append-only invariant の二段階保証

| 不変条件 | freeze 前 | freeze 後 |
|---|---|---|
| 現実装の ABI が `setWord` / `removeWord` を持たない | ○（実装の事実） | ○（実装の事実） |
| 実装を差し替えて mutator を追加されない | △（owner 信頼前提） | ○（契約レベル不可能） |

freeze **前** でも `addWords` による append は可能（onlyOwner）。`addWords` は ADR-0002 の append-only invariant に沿う行為で、上書きではないため freeze の対象外。

### 拒絶した案

| 案 | 拒絶理由 |
|---|---|
| (A) owner = Gnosis Safe multisig | key 集合の信頼前提が残り、契約レベルでの保証にならない |
| (B) Timelock + multisig | (A) と同じ。攻撃検知は強化されるが、不変条件の根拠が運用に残る |
| (D) `_authorizeUpgrade` を別 admin (timelock) に分離 | (B) と同じ。"運用主体への信頼" が残る |
| (E) 何もしない (status quo) | Dream の永続性主張と矛盾 |

(C) freeze 案は upgrade 機構を捨てる代償が大きいが、Dream の「永続化」を契約レベルの不変条件として固定できる唯一の選択肢。multisig / timelock 系（A / B / D）は **freeze 前 Phase の安全網としては有用** だが、freeze そのものを代替する手段にはならない。

## Consequences（結果）

### Pros

- **契約レベルでの append-only 保証**：freeze 後は owner であっても過去単語を書き換えられない
- **Dream との一貫性**：「永続化」の根拠が運用主体ではなく contract bytecode 自体に
- **シンプル**：multisig / timelock のような追加 infrastructure を必要としない

### Cons

- **bug fix も不可**：freeze 後に implementation バグが発覚しても修正不能。語彙確定 + dry-run 確認を freeze 前に丁寧にやる必要がある
- **freeze タイミングの判断**：早すぎると bug fix の機会を失い、遅すぎると「永続化」の主張が宙に浮く
- **freeze そのものが onlyOwner**：freeze まで実行できる owner キー（または owner = multisig 設計）の信頼は freeze 実行までは必要。これは Phase 1 に限定された信頼

### freeze 実行前のチェックリスト

freeze は不可逆なので、本番デプロイの実装上は以下のチェック後に execute すること（運用 runbook に反映する）：

1. [ ] 初期語彙の選定が完了し、`addWords` で全件投入済み
2. [ ] testnet 上で「freeze → addWords → revert を確認」「freeze → upgradeTo → revert を確認」を実機確認
3. [ ] storage layout の最終形を OpenZeppelin Upgrades plugin で validate
4. [ ] PR #19 / #22 で merge した tokenURI Dream 経路が production traffic で問題ないことを確認

## Implementation Notes

- `frozen` は新規 storage slot。layout 末尾に追加（ADR-0002 同等の append rule）
- `freeze()` は idempotent **ではない**（2 度目は revert "already frozen"）。意図的に「明示的な再 freeze が事故を呼ばないように」エラーで気付ける
- `UpgradesFrozen` event は off-chain 監視で freeze 状態を即座に検出できるように indexed なしでシンプルに

## 関連

- Issue #21（本 ADR が close する）
- PR #20（Dictionary contract 本体）
- Codex review thread on PR #20 — 本 ADR の trigger
- ADR-0002 §10 — owner 権限の設計余地について本 ADR への先送りを明記
