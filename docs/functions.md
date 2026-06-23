# Functions

This document tracks the current function rules in Pulse.

## Rules

- Functions use the syntax `fn name(parameters): returnType { ... }`
- Functions can optionally declare `throws TypeA, TypeB` after the return type
- Every parameter must declare `val` or `var`
- Every parameter must declare its type explicitly
- Every function must declare its return type explicitly
- Function parameters cannot use the `void` type
- Function parameters cannot use the `unknown` type
- Every function must end with an explicit `return` statement
- `void` functions must use `return;`
- Non-void functions must return a value compatible with the declared return type
- `return null;` is only valid when the declared return type is nullable
- Throwing functions with a non-`void` return type must use `return value, error;`
- Throwing functions with a `void` return type must use `return error;` or `return null;`
- Throwing calls with a return value must be captured with two variable bindings
- Throwing calls without a return value must be captured with a single nullable error binding
- Only imports, functions, classes, and single variable declarations are allowed at the top level

## Valid Example

```pulse
fn sum(val a: int, val b: int): int {
  return a + b;
}

fn logValue(val value: int): void {
  return;
}

fn parse(val text: string): int? throws ParseError {
  if (text == "") {
    return null, ParseError("Empty text");
  }

  return 10, null;
}
```
