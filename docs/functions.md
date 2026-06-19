# Functions

This document tracks the current function rules in Pulse.

## Rules

- Functions use the syntax `fn name(parameters): returnType { ... }`
- Every parameter must declare its type explicitly
- Every function must declare its return type explicitly
- Function parameters cannot use the `void` type
- Every function must end with an explicit `return` statement
- `void` functions must use `return;`
- Non-void functions must return a value compatible with the declared return type
- `return null;` is only valid when the declared return type is nullable
- Top-level executable statements are not allowed outside functions

## Valid Example

```pulse
fn sum(a: int, b: int): int {
  return a + b;
}

fn logValue(value: int): void {
  return;
}
```
