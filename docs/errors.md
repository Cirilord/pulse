# Errors

This document tracks the current builtin `Error` support in Pulse.

## Rules

- `Error` is a builtin class
- You do not declare `class Error` in user code
- `Error(message)` constructs an `Error` value
- `Error` currently exposes the public `message: string` field
- The C backend emits a runtime error handler when a program uses `Error`
- The runtime handler is internal for now and exists to support future error features

## Valid Example

```pulse
fn buildError(): Error {
  return Error("Invalid age");
}

fn main(): int {
  val error: Error = buildError();

  if (error.message == "Invalid age") {
    return 1;
  }

  return 0;
}
```
