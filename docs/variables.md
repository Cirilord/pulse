# Variables

Pulse uses explicit static typing with no type inference.

## Rules

- `var` declares a mutable variable
- `val` declares an immutable value
- All variable declarations must include an explicit type
- `val` declarations must always include an initializer
- To start with `null`, the declared type must be nullable
- Nullable types use the `?` suffix
- `null` is an explicit keyword and literal
- The current primitive types are `int`, `byte`, `float`, `double`, `char`, `string`, `boolean`, and `void`

## Valid Examples

```pulse
var age: int = 30;
var flags: byte = 255;
val ratio: float = 12.25;
val score: double = 42.5;
val initial: char = "P";
var enabled: boolean = true;
val name: string = "Pulse";
var nickname: string? = null;
val alias: string? = null;
```

## Invalid Examples

```pulse
var age = 30;
val name: string;
var nickname: string = null;
val alias = null;
```

## Notes

- `string?` means `string | null`
- `return null;` is only valid when the expected return type is nullable
