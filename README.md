# Pulse

A programming language project built in TypeScript.
This README should be kept up to date as the project evolves.

## Documentation

- `docs/language.md` for the general language overview
- `docs/variables.md` for variable and nullability rules
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
- The compiler currently supports function declarations, function calls, explicit `return` statements, block statements with lexical scoping, `if`/`elif`/`else`, `while`, `do while`, `for`, `break`, `continue`, identifier references, grouping with parentheses, unary expressions, arithmetic, bitwise operations, comparisons, logical expressions, conditional expressions, null coalescing expressions, and compound assignment statements
- Function, method, and constructor parameters currently require explicit `val` or `var`
- The compiler currently supports classes with fields, constructors, instance methods, static methods, `this`, field access, method calls, and constructor calls
- The compiler currently provides a builtin `Error` class with a `message: string` field and `Error(message)` constructor calls
- Nullable equality with `==` and `!=` is supported, including comparisons against `null`
- Conditions and logical negation use strict non-nullable `boolean` values only, with no truthy or falsy coercion
- Top-level executable statements are not allowed
- The `compile` command currently reads the input file, tokenizes it, parses it, checks it, generates C, and compiles it with `clang` or `gcc`
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
