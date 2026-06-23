# Classes

This document tracks the current class rules in Pulse.

## Rules

- Classes use the `class` keyword
- Classes can extend one base class with `class Name extends Base`
- Overridden inherited methods must use `override`
- Fields must declare `public` or `private`
- Fields must use `val` or `var`
- Methods must declare `public` or `private`
- Methods use `fn`
- Static methods use `static fn`
- Constructors use `fn constructor(...)` and do not declare a return type
- `this` is only available inside instance methods and constructors
- `this` is not available inside top-level functions or static methods
- `super` is only available inside instance methods and constructors of derived classes
- `super.field` can read inherited public fields from the immediate base chain
- `super(...)` calls the base class constructor inside a derived constructor
- `super(...)` must be the first statement in a derived constructor
- `super(...)` can only be called once per derived constructor
- Derived constructors must call `super(...)` when the base class declares a constructor
- `Type(...)` calls the class constructor
- `Type.method(...)` calls a static method
- `Type.name` returns the class name as `string`
- `Type.toString()` returns the class shape as `string`
- `value.method(...)` calls an instance method
- Public fields and methods are inherited
- Private fields and methods remain private to the class that declared them
- Subtype assignment is currently blocked, so derived class values cannot be assigned to base class variables
- `isInstance(value, Type)` checks whether a class instance has the exact runtime type `Type`
- `isInstance(value, Type)` also matches subclasses of `Type`
- `=` copies values
- `Error` is a builtin class documented in `docs/errors.md`
- The generated C uses an implicit shared `object_t` runtime base for all classes

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

## Inheritance Example

```pulse
class Person {
  public val name: string;

  public fn constructor(val name: string) {
    this.name = name;
  }

  public fn getLabel(): string {
    return this.name;
  }

  public fn getType(): string {
    return "person";
  }
}

class Admin extends Person {
  public val role: string;

  public fn constructor(val name: string, val role: string) {
    super(name);
    this.role = role;
  }

  public fn getRole(): string {
    return this.role;
  }

  public override fn getType(): string {
    return "admin";
  }

  public fn getBaseType(): string {
    return super.getType();
  }

  public fn getBaseName(): string {
    return super.name;
  }
}
```
