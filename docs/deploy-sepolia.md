# Sepolia テストネットへのデプロイ手順

## 前提条件

- Node.js 22.x / pnpm
- 1Password CLI (`op`) — 秘密鍵・RPC URL の注入に使用
- Sepolia ETH — [Alchemy Faucet](https://sepoliafaucet.com/) などで補充

---

## RPC 経路の選択

| 用途 | サービス | 備考 |
|------|----------|------|
| **通常デプロイ** | [Chainstack](https://chainstack.com/) | 推奨メイン経路 |
| **Agent 自動化（将来）** | [QuickNode paid](https://www.quicknode.com/) | 高レートリミット・webhook 対応 |
| **Debug / simulation** | [Tenderly](https://tenderly.co/) | トランザクション模倣・フォーク |
| **Read-only smoke** | PublicNode / dRPC などの公開 RPC | 障害切り分け専用。デプロイには使わない |

> Ankr 無認証エンドポイントは現在 API key 必須のため fallback 経路には使えない。

---

## 環境変数の準備（1Password 注入）

秘密鍵・RPC URL を `.env` に平文で書かず、`op read` で実行時注入する。

```bash
# Sepolia RPC URL（Chainstack の Node URL を使う場合）
export SEPOLIA_URL="$(op read "op://Personal/Chainstack Sepolia/url")"

# テストウォレットの秘密鍵
export TEST_WALLET_PRIVATE_KEY="$(op read "op://Personal/TestWallet/private key")"

# Etherscan API Key（verify 用）
export ETHERSCAN_API_KEY="$(op read "op://Personal/Etherscan/apiKey")"
```

1Password のアイテム名・フィールド名は実際の vault に合わせて変更すること。

### `.envrc` を使う場合

```bash
# .envrc（direnv allow 後に自動読み込み）
export SEPOLIA_URL="$(op read "op://Personal/Chainstack Sepolia/url")"
export TEST_WALLET_PRIVATE_KEY="$(op read "op://Personal/TestWallet/private key")"
export ETHERSCAN_API_KEY="$(op read "op://Personal/Etherscan/apiKey")"
```

---

## RPC 事前確認

デプロイ前に `chainId` と最新ブロック番号を確認する：

```bash
pnpm run rpc:check:sepolia
```

期待出力例：

```text
Network : sepolia
chainId : 11155111
Block   : 7654321
```

`chainId` が `11155111` でなければ RPC URL が誤っている。

---

## デプロイ手順

### 1. コンパイル・テスト

```bash
pnpm compile
pnpm test
```

### 2. Dictionary + EMJ をデプロイ

```bash
pnpm run deploy:sepolia
```

`.openzeppelin/sepolia.json` が生成されることを確認。以降のアップグレード追跡に必要なため git に追加してよい（proxy アドレスのみ記録、秘密情報なし）。

### 3. 初期化

`scripts/initialize.ts` の定数（日程・アドレス）を実際の値に書き換えてから実行：

```bash
# 必要に応じて環境変数でアドレスを注入
ROYALTY_RECEIVER="$(op read "op://Personal/EMJ/royalty receiver")" \
WITHDRAWAL_RECEIVER="$(op read "op://Personal/EMJ/withdrawal receiver")" \
  pnpm run initialize:sepolia
```

### 4. Etherscan へ verify

```bash
pnpm run verify:sepolia
```

### 5. 動作確認

```bash
pnpm run proxy:sepolia    # proxy アドレスを確認
pnpm run balance:sepolia  # デプロイアカウントの残高を確認
```

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| `invalid project ID` / `connection refused` | `SEPOLIA_URL` 未設定または誤り | `rpc:check:sepolia` で確認 |
| `nonce too low` | 前回のトランザクションがペンディング中 | [Sepolia Etherscan](https://sepolia.etherscan.io/) でキャンセルまたは待機 |
| `insufficient funds` | Sepolia ETH 残高不足 | faucet で補充 |
| `Proxy already initialized` | `initialize` を二重実行 | `.openzeppelin/sepolia.json` を確認してスキップ |

---

## 関連

- [ADR-0006 — Transparent Proxy](./adr/0006-emj-transparent-proxy.md)
- Issue #40 — Sepolia テストネット対応 + 1Password ウォレットでの実デプロイテスト
- Issue #42 — Chainstack RPC 環境と Sepolia 検証導線を整備する
