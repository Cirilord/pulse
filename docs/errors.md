# Errors

This document tracks the current `throws` and error-return support in Pulse.

## Rules

- `Error` is a builtin class
- You do not declare `class Error` in user code
- `Error(message)` constructs an `Error` value
- `Error` currently exposes the public `message: string` field
- Functions and methods can declare `throws TypeA, TypeB`
- Throwing functions with a non-`void` return type must return `value, error`
- Throwing functions with a `void` return type must return only the error value
- Single thrown types are captured with their exact nullable type
- Multiple thrown types are captured with `unknown?`
- `isInstance(value, Type)` can be used to refine `unknown?` error bindings
- After a successful `isInstance(value, Type)` check, the refined value can access the target type fields inside that branch

## Valid Example

```pulse
class ParseError extends Error {
  public fn constructor(val message: string) {
    super(message);
  }
}

class IoError extends Error {
  public fn constructor(val message: string) {
    super(message);
  }
}

fn parse(val text: string): int? throws ParseError, IoError {
  if (text == "") {
    return null, ParseError("Empty text");
  }

  return 10, null;
}

fn save(val text: string): void throws IoError {
  if (text == "") {
    return IoError("Empty text");
  }

  return null;
}

fn main(): int {
  val value: int?, val err: unknown? = parse("");
  val saveErr: IoError? = save("ok");

  if (saveErr != null) {
    return 2;
  }

  if (err != null && isInstance(err, ParseError)) {
    return err.message == "Empty text" ? 1 : 3;
  }

  return value ?? 0;
}
```
