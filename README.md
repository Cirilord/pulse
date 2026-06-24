# Pulse

A programming language project built in TypeScript.
This README should be kept up to date as the project evolves.

## Documentation

- `docs/language.md` for the general language overview
- `docs/variables.md` for variable and nullability rules
- `docs/modules.md` for local module import and export rules
- `docs/classes.md` for class and object rules
- `docs/errors.md` for builtin error rules
- `docs/expressions.md` for expression rules
- `docs/control-flow.md` for conditions, loops, and block rules
- `docs/functions.md` for function and return rules

## Project Status

- A basic lexer foundation is available in `src/lexer`
- A basic parser foundation is available in `src/parser`
- A basic semantic checker is available in `src/checker`
- A basic C generator is available in `src/codegen`
- A basic native compilation runner is available in `src/compiler`
- The compiler currently supports function declarations, `throws`, explicit `return` statements, `defer` statements, block statements with lexical scoping, `if`/`elif`/`else`, `while`, `do while`, `for`, `break`, `continue`, identifier references, grouping with parentheses, unary expressions, arithmetic, bitwise operations, comparisons, logical expressions, conditional expressions, null coalescing expressions, and compound assignment statements
- The compiler currently supports local Pulse file imports with `import ... from "./file"`, top-level `export` on classes, functions, and single variable declarations, plus `export * from "./file"` and `export { A, B } from "./file"` reexports
- The compiler currently supports cataloged C imports such as `import CStd, { abs } from "c:stdlib.h";`
- The compiler currently supports manual C bindings such as `import CLib from "c:stdlib.h" extern { fn abs(val value: int): int; }`
- Function, method, and constructor parameters currently require explicit `val` or `var`
- The compiler currently supports classes with single inheritance via `extends`, `override`, fields, constructors, instance methods, static methods, `this`, `super`, `super.field`, strict `super(...)` constructor calls in derived classes, field access, method calls, builtin `Class.name`, builtin `Class.toString()`, builtin `isInstance(value, Type)`, and constructor calls
- Subtype assignment between classes is currently blocked, so derived class values cannot yet be assigned to base class variables
- The generated C currently lowers every class through an implicit shared `object_t` runtime base
- Throwing calls currently return their error values explicitly, using `unknown?` when a call declares multiple thrown types
- `isInstance(value, Type)` currently narrows `unknown?` values inside matching `if` branches
- The compiler currently provides a builtin `Error` class with a `message: string` field and `Error(message)` constructor calls
- Nullable equality with `==` and `!=` is supported, including comparisons against `null`
- Conditions and logical negation use strict non-nullable `boolean` values only, with no truthy or falsy coercion
- Builtin Pulse library imports are not supported yet
- Cataloged C imports currently support named, namespace, and mixed imports only
- Manual `extern` bindings currently support namespace and star imports only, and they currently require `"c:..."` sources
- Top-level declarations currently allow imports, functions, classes, and single variable declarations only
- Top-level variables are currently lowered as generated globals and initialized before the user `main(): int`
- The `compile` command currently reads the input file, tokenizes it, parses it, checks it, generates C, and compiles it with `clang` or `gcc`
- The `compile` command currently resolves local relative Pulse module imports before checking and generating C
- The generated C currently maps Pulse `string` values to an internal `string_t` runtime struct
- Nullable variables are currently emitted as internal `<base>_nullable` runtime structs in the generated C
- When a program uses `Error`, the generated C emits an internal runtime error handler

## Setup

```bash
yarn install
```

## Usage

```bash
yarn start:dev compile examples/variables.p
yarn start:dev compile examples/variables.p --emit-c
yarn start:dev compile examples/variables.p --emit-c examples/variables.c
yarn start:dev compile examples/variables.p -o variables-bin
yarn generate:examples-c
```

## Tests

```bash
yarn test
```
