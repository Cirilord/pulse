# Variables

Pulse uses explicit static typing with no type inference.

## Rules

- `var` declares a mutable variable
- `val` declares an immutable value
- All variable declarations must include an explicit type
- `val` declarations must always include an initializer
- `var` declarations can be reassigned with `=`, `+=`, `-=`, `*=`, `/=`, `%=` and the supported compound operators when the types are compatible
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
- Variables with nullable types are currently emitted as internal `<base>_nullable` structs in the C backend, such as `string_t_nullable`
- The current C backend maps Pulse `string` values to an internal `string_t` runtime struct
