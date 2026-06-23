# Classes

This document tracks the current class rules in Pulse.

## Rules

- Classes use the `class` keyword
- Fields must declare `public` or `private`
- Fields must use `val` or `var`
- Methods must declare `public` or `private`
- Methods use `fn`
- Static methods use `static fn`
- Constructors use `fn constructor(...)` and do not declare a return type
- `this` is only available inside instance methods and constructors
- `this` is not available inside top-level functions or static methods
- `Type(...)` calls the class constructor
- `Type.method(...)` calls a static method
- `Type.name` returns the class name as `string`
- `Type.toString()` returns the class shape as `string`
- `value.method(...)` calls an instance method
- `isInstance(value, Type)` checks whether a class instance has the exact runtime type `Type`
- `=` copies values
- `Error` is a builtin class documented in `docs/errors.md`

## Valid Example

```pulse
class User {
  public val name: string;
  private var age: int;

  public fn constructor(val name: string, val age: int) {
    this.name = name;
    this.age = age;
  }

  public fn birthday(): void {
    this.age += 1;
    return;
  }

  public fn getAge(): int {
    return this.age;
  }

  public static fn createAdult(val name: string): User {
    return User(name, 18);
  }
}

fn main(): int {
  val className: string = User.name;
  val classShape: string = User.toString();

  if (className == "User" && classShape != "") {
    return 1;
  }

  return 0;
}
```
