# Rust Conventions

## Error Handling

- **Never use `unwrap()` or `expect()` in production code** — propagate errors
  with `?` or handle explicitly with `match` / `if let`
- **`clippy::unwrap_used` is denied** in projects — treat any `unwrap()` as a
  compile error
- Prefer `thiserror` for domain errors, `anyhow` / `Box<dyn Error>` for
  application-level plumbing

## Testing

### Test functions must return `Result`

**Always use `-> Result<(), Box<dyn std::error::Error>>` (or a concrete error
type) and propagate with `?`.** Never use `unwrap()` or `expect()` — even in
tests. This keeps test code consistent with production lint rules and produces
clearer failure messages.

```rust
// Good — Result + ?
#[test]
fn parses_valid_input() -> Result<(), Box<dyn std::error::Error>> {
    let value: MyStruct = serde_json::from_str(INPUT)?;
    assert_eq!(value.name, "expected");
    Ok(())
}

// Bad — unwrap / expect
#[test]
fn parses_valid_input() {
    let value: MyStruct = serde_json::from_str(INPUT).unwrap();
    assert_eq!(value.name, "expected");
}
```

### Asserting expected errors

Use `expect_err()` when extracting an error value for further assertions.
Avoid the verbose `let Err(e) = ... else { panic!() }` pattern.

```rust
// Good
let err = action().expect_err("should fail");
assert!(err.to_string().contains("invalid"));

// Verbose — avoid
let Err(err) = action() else { panic!("should fail") };
```

### Mock strategy

- **Prefer real types** for value objects, entities, and pure logic
- **Use mocks / test doubles** for repositories, external services, and I/O

## Iteration

**Prefer iterator chains over imperative loops.** Rust's iterator API
(`map`, `filter`, `flat_map`, `fold`, `collect`) is zero-cost and expressive.

```rust
// Good
let names: Vec<_> = users.iter().filter(|u| u.active).map(|u| &u.name).collect();

// Avoid
let mut names = Vec::new();
for u in &users {
    if u.active {
        names.push(&u.name);
    }
}
```

**`fold` with mutable accumulator** is acceptable for performance-critical
aggregation (analogous to `reduce(into:)` in Swift).

## Pattern Matching

- **Exhaust all variants** — avoid `_ =>` catch-all on enums when possible,
  so new variants cause compile errors
- **Use `if let` / `let else` for single-variant checks** instead of full
  `match` when only one arm matters

```rust
// Good — guard clause with let else
let Some(user) = repo.find(id).await? else {
    return Err(NotFound(id));
};

// Avoid — match with only one meaningful arm
match repo.find(id).await? {
    Some(user) => { /* ... */ }
    None => return Err(NotFound(id)),
}
```

## Module & Crate Organization

- **One responsibility per crate** — keep crates small and focused
- **`pub use` re-exports** in `mod.rs` / `lib.rs` to flatten deep module paths
- **Feature flags** for optional dependencies (e.g., `serde` support in domain
  crates)

## Naming

Follow Rust API Guidelines (RFC 430):

- **Types**: `PascalCase` — `ItemStatus`, `DomainEvent`
- **Functions / methods**: `snake_case` — prefer past participles for pure
  transforms (`sorted`, `encoded`, `resolved`) over imperative verbs
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Modules / crates**: `snake_case`
