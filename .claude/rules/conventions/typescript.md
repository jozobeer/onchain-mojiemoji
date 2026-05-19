# TypeScript Conventions

> **Status: skeleton.** 最小限の規約のみ。実プロジェクトで使う際に項目を追加していく。

## Force Unwrap / Non-null Assertion

Repo-Forge 共通原則「強制 unwrap 禁止」を TS では以下に読み替える：

- non-null assertion `!`（例: `foo!.bar`）禁止
- `as` キャスト（型強制）の濫用禁止 — 型ガードまたは `unknown` 経由で
- `// @ts-ignore` / `// @ts-expect-error` は理由付きコメント必須、PR で議論

エラーは握り潰さず明示的に伝播：

```ts
// Good — explicit error propagation
const result = await fetchUser(id);
if (!result.ok) throw new UserFetchError(result.error);
return result.value;

// Bad — silent any-cast
const user = (await fetchUser(id) as any).value;
```

## Type Safety

- `any` は最終手段。`unknown` ＋ 型ガードで表現できないか先に検討
- `interface` で contract を、`type` で union/intersection を表現
- Discriminated union（タグ付き union）でドメイン状態を表現すると網羅チェックが効く

```ts
type RecordingState =
  | { kind: 'idle' }
  | { kind: 'recording'; startedAt: Date };

function describe(s: RecordingState): string {
  switch (s.kind) {
    case 'idle': return '待機中';
    case 'recording': return `録画中（${s.startedAt}〜）`;
    // 新 variant が増えると default なしでコンパイルエラー
  }
}
```

## Functional Style

- `let` 禁止 — `const` のみ、再代入したいなら関数を分離
- `for` / `while` ループより `map` / `filter` / `reduce`
- 副作用は境界（adapter）に閉じる、domain / usecase は pure

## Naming

- **types / classes / interfaces**: `PascalCase`
- **functions / variables**: `camelCase` — 純粋関数は名詞 / 過去分詞（`sorted`, `resolved`）、副作用は動詞（`save`, `notify`）
- **constants**: `SCREAMING_SNAKE_CASE`（モジュールトップレベル）または `camelCase`（ローカル）
- **files**: `kebab-case.ts` または `PascalCase.ts`（プロジェクト規約に従う）

## Modern Features

- `async` / `await`、`?.` optional chaining、`??` nullish coalescing を積極活用
- Top-level `await` は ESM の場合のみ可
- `satisfies` で型を絞りつつ推論を残す
