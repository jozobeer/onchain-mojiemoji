---
name: ignite
description: |
  Repo-Forge で scaffold した子リポで Claude が立ち上がった直後に invoke する着火スキル。
  必読を読み、Dream を 1 文で復唱して人間に確認させ、構成を把握し、最初の TDD サイクル候補を 1 つだけ提示する。
  「次に何をすべきか」を判断せずダラっと作業を始めるのを防ぐ。Phase 1 の Dream 復唱が唯一の人間ゲート、それ以降は autonomous loop に橋渡し可能。
---

# ignite — 子リポ立ち上げ着火スキル

`scaffold-repo` がリポを「作る」までを担うのに対し、本 skill は scaffold 後の子リポで
**Claude が立ち上がった瞬間の最初の判断を支援**する。Dream の言語化を「持ち主にしかできない」
人間ゲートで保護しつつ、それ以外を deterministic に進める。

## 使う場面

- `scaffold-repo` で生成した子リポに最初に Claude を起動した時
- 別マシンで子リポを clone してきて開発を始める時
- 数日〜数週間ぶりに子リポに戻ってきた時（コンテキスト復元として）

## 5 段階のフロー

```
Phase 0  必読       コンテキストを読む（CLAUDE.md / PRINCIPLES / README / 直近 5 コミット）
Phase 1  復唱       Dream を 1 文で言い直して人間に確認させる ← 唯一の人間ゲート
Phase 2  把握       ワークスペース構成・空モジュール・テスト有無を棚卸し
Phase 3  一手提示   最初の TDD サイクル候補を 1 つだけ提案
Phase 4  確認       「この一手でいい？」を聞き、OK で tdd-spec に橋渡し
```

各 Phase を **順番に**、**Skip せず**進める。Phase 1 で人間が「違う」と言えば、
推測で書き直さずもう一度聞く。

---

## Phase 0 — 必読

下記を **この順番で** 読む（順序が文脈構築に効く）：

1. `.claude/CLAUDE.md`（プロジェクトの入口・原則・命名）
2. `docs/PRINCIPLES.md`（あれば。Repo-Forge から継承した設計原則）
3. `README.md`（公開向けの全体像）
4. 直近 5 コミット（`git log --oneline -5`）

読んだら **ユーザーには報告しない**。Phase 1 でまとめて出す。

---

## Phase 1 — Dream 復唱（人間ゲート）

CLAUDE.md と README.md から拾った Dream を **1 文** で言い直して提示する：

```
> Dream の理解：
> 「<dream を 1 文で>」
>
> これで合ってる？違う部分があれば訂正を。
```

ユーザーが「うん」「OK」「合ってる」等の肯定を返すまで Phase 2 に進まない。
「違う」と言われたら推測で直さず、何が違うか聞く。

> **Hard Rule**: ユーザーの肯定を得る前に Phase 2 以降に進むことを禁ずる。
> Dream は持ち主にしか書けない。代弁は Repo-Forge の設計原則違反。

---

## Phase 2 — 把握

下記を deterministic に集めて、**コンパクトな概要表** で提示する：

| 観点 | 集める内容 |
|---|---|
| 言語・ビルド | `Cargo.toml` / `Package.swift` / `package.json` / `pyproject.toml` 等の有無と内容 |
| Layer 構成 | `src/` `Sources/` 配下のサブディレクトリ／クレート／モジュール一覧 |
| 空モジュール | ファイルが `mod.rs` / `Package.swift` の宣言だけで実装ゼロのもの |
| プレースホルダ残骸 | `grep -r '{{[a-z_]*}}' .` で検出される `{{...}}` 残り |
| 既存テスト | `tests/` `Tests/` `__tests__/` の有無と件数 |
| Domain 候補 | CLAUDE.md / README.md でユビキタス言語として宣言された名詞 |

報告フォーマット例：

```
## 構成

- 言語: Rust (Cargo workspace, 6 crates)
- Layer: domain / ports / adapters / usecases / orchestrator / cli
- 空モジュール: domain (lib.rs に pub mod 宣言のみ)
- プレースホルダ残骸: なし
- 既存テスト: 0 件
- ユビキタス言語: <Term1>, <Term2>, <Term3>
```

---

## Phase 3 — 一手提示

**1 つだけ** 提案する。複数候補を並べない（一手の意味が消える）。

選択基準：

1. **最小の Domain entity** が候補の第 1 優先。理由：純粋・依存ゼロ・テストが書きやすい
2. それが無ければ **最外側の port**（trait / protocol / interface）。理由：境界が明確
3. それも無ければ **核となる usecase の signature**

提案フォーマット：

```
## 最初の一手

`tdd-spec` で **<具体的なクラス／関数名>** の最初の失敗テストを書く。

- 場所: `<ファイルパス候補>`
- 振る舞い: <1 文で>
- なぜここから: <選択理由を 1 文で>
```

---

## Phase 4 — 確認

```
> この一手でいい？
> （違うなら別の候補を提案する）
```

ユーザーが OK を出したら **`tdd-spec` skill に橋渡し**して終わる。
本 skill はここで仕事を終える。tdd-spec → tdd-impl が autonomous loop の本体。

「違う」と言われたら：別候補を 1 つ出す。それでも違ければ Phase 2 の理解を疑い、
ユーザーに「どこから始めたい？」と直接聞く。

---

## 出力スタイル

- 全 Phase で **Markdown 見出し ＋ 箇条書き** を使う（口頭では追えない情報量を制御）
- mojiemoji decoration は **Phase 1 / Phase 3 のキーワード** にだけ控えめに
  （`mojiemoji-github` skill 経由）
- 過剰な前置き・自己紹介・「私は AI です」みたいな文は禁止

---

## Anti-Pattern

- ❌ Phase 1 の Dream を AI が書く・推測で埋める
- ❌ Phase 3 で 3 つも 4 つも候補を並べる（決断疲れを生む）
- ❌ Phase 0 を Skip して Phase 1 に飛ぶ（必読の前提なしに復唱はできない）
- ❌ 必読を読んだ内容をユーザーに長々と報告する（Phase 1 の復唱で要約は十分）
- ❌ Phase 4 の確認を省いて勝手に `tdd-spec` を invoke する（人間ゲート違反）
- ❌ scaffold-repo の Phase ⑥ を再実行しようとする（このスキルの守備範囲外）

---

## scaffold-repo / tdd-spec との境界

```
[Repo-Forge 側]                      [子リポ側]
  scaffold-repo  --→  push & ghr re-pull  --→  ignite  --→  tdd-spec  --→  tdd-impl
  Phase ①〜⑥                                   Phase 0〜4    （ここから自走）
```

- `scaffold-repo`: リポを **作る**。Repo-Forge 側で実行
- `ignite`: 子リポで **始める**。本 skill
- `tdd-spec` / `tdd-impl`: 子リポで **続ける**。autonomous loop の主役

`ignite` は **入口の整備係**。Dream の言語化と最初の一手の決定だけ担当して、
あとは TDD ループにバトンを渡す。
