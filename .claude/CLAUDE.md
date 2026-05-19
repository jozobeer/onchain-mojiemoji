# CLAUDE.md — Onchain Mojiemoji

このリポは [Repo-Forge](https://github.com/jozobeer/repo-forge) から scaffold された **onchain-mojiemoji**。
Repo-Forge とは独立しており、Repo-Forge が消えても動く（**Standalone**）。

---

## Dream（このプロダクトの存在理由）

> mojiemoji の URL = 画像という性質を Ethereum に焼き込んで NFT として永続化する

詳細は [`README.md`](../README.md) と起点 Issue / PR を参照。
**Dream を薄める変更を検出したら立ち止まる**（Domain 改変要求の段で「Dream の進化か変質か」を問う）。

---

## アーキテクチャ ADR ― scaffold 時の選定

### 採用したお手本

- **モノリポ骨格**：[GeneralD/project-template-hardhat-erc721psi-upgradeable](https://github.com/GeneralD/project-template-hardhat-erc721psi-upgradeable)
- **部分パターン**：- [GeneralD/Sutra](https://github.com/GeneralD/Sutra) ― Swift 製テンプレート展開エンジン（この雛形を Sutra に食わせて新リポを起こした）

### 採用したパターン

- ERC721Psi（gas 効率の良いバッチ mint）＋ Burnable ＋ Upgradeable
- OpenZeppelin Upgrades plugin（UUPS / Transparent proxy）
- Operator Filter Registry（取引制限の取り込み）
- Merkle proof allowlist mint
- ドメイン別に 11 本の test ファイル（Mint / Burn / Royalty / TokenURI / Allowlist / ...）

### 捨てたパターン

- IPFS / Arweave による画像ホスティング ― tokenURI が mojiemoji.jozo.beer の URL を直接返すので不要
- 静的メタデータ JSON ― オンチェーンのパラメータから tokenURI を動的生成するため固定化しない

### 依存方向

常に **外 → 内**（Clean Architecture / hexagonal）：

```
adapter ──> usecase ──> domain
   ▲           ▲          ▲
   └─ port ────┘          │
                          │
   Domain は外部の何にも依存しない（純粋）
```

---

## 作業の原則

### コード品質

- **TDD**：[`tdd-spec`](./skills/tdd-spec/SKILL.md) で先にテストを書き、[`tdd-impl`](./skills/tdd-impl/SKILL.md) で実装を埋める
- **テスト = 仕様**。テストを安易に変えない
- **REALWORLD（時間・乱数・FS・env・network・外部API・subprocess）は port 化**
- **強制 unwrap 禁止**（Swift `!` / `try!` / `as!`、Rust `unwrap()` / `expect()`、TS non-null assertion `!`（例: `foo!.bar`））。エラーは握り潰さず明示的に伝播
- **カバレッジ 95% 以上**（Domain / DI / Orchestrator は除外）
- 装飾的な綺麗さは諦めてよい。**ドメインの整然な表現は諦めない**

### Standalone 原則

- このリポは Repo-Forge に依存しない（`uses: jozobeer/repo-forge/...` などは禁止）
- secrets は repo-level に焼き付ける（org-level 依存禁止）
- 雛形は scaffold 時にコピー済み。Repo-Forge 側の更新を追従する義務はない

---

## 言語

- ユーザーとの応答：日本語（default: 日本語）
- ドキュメント：日本語
- コード：英語（識別子・コメント）

### ユビキタス言語

- **Stamp** ― 1 つの mojiemoji 画像
- **Param** ― Stamp を生成するための URL パラメータ群（text / font / color / speed など）
- **Token** ― ERC-721 上の所有単位（1 token = 1 Stamp）
- **Mint** ― Stamp を NFT 化する操作
- **Allowlist** ― mint 権限のホワイトリスト（Merkle proof で検証）
- **TokenURI** ― tokenId から動的に組み立てた mojiemoji URL

---

## ローカル規約（`.claude/`）

ルール（`.claude/rules/`）― リポ内コピー保管、`~/.config/claude/` がなくても自走する：

- [`code-philosophy.md`](./rules/code-philosophy.md)
- [`development-practices.md`](./rules/development-practices.md)
- [`coverage-ignored-modules.md`](./rules/coverage-ignored-modules.md)
- [`git-workflow.md`](./rules/git-workflow.md)
- [`github-markdown.md`](./rules/github-markdown.md)
- [`conventions/typescript.md`](./rules/conventions/typescript.md) ― 言語固有の規約（typescript）

スキル（`.claude/skills/`）― 同名スキルがあればプロジェクト版が優先：

- [`tdd-spec`](./skills/tdd-spec/SKILL.md)
- [`tdd-impl`](./skills/tdd-impl/SKILL.md)
- [`ignite`](./skills/ignite/SKILL.md) ― リポを clone した直後・数日ぶりに戻ってきた時の着火（Dream 復唱 → 構成把握 → 一手提示）
- [`mojiemoji-github`](./skills/mojiemoji-github/SKILL.md) ― 日本語 GitHub body の装飾（issue / PR / comment / release notes）
- [`make-image`](./skills/make-image/SKILL.md) ― Codex CLI 経由でヒーロー画像・OGP・バナー等を生成

エージェント（`.claude/agents/`）：

- [`mojiemoji-selector`](./agents/mojiemoji-selector.md) ― mojiemoji-github skill が dispatch する装飾選定 subagent

> いずれも Repo-Forge から雛形コピーされた汎用資産。
> standalone 原則：`~/.config/claude/` がない環境でも、このリポはこれらだけで動く。

---

## Anti-Pattern

- Dream に無い概念を Domain に追加する
- domain / usecase で REALWORLD を直接呼ぶ
- adapter で強制 unwrap（`!` / `unwrap()` 等）を使う
- テストを書かずに実装する
- 装飾的なリファクタを「綺麗にしました」と PR で出す
