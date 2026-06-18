# Pulse

A programming language project built in TypeScript.
This README should be kept up to date as the project evolves.

## Documentation

- `docs/language.md` for the general language overview
- `docs/variables.md` for variable and nullability rules

## Project Status

- A basic lexer foundation is available in `src/lexer`
- A basic parser foundation is available in `src/parser`
- A basic semantic checker is available in `src/checker`
- A basic C generator is available in `src/codegen`
- A basic native compilation runner is available in `src/compiler`
- The compiler currently supports identifier references, grouping with parentheses, unary expressions, arithmetic, bitwise operations, comparisons, logical expressions, conditional expressions, null coalescing expressions, and compound assignment statements
- Nullable equality with `==` and `!=` is supported, including comparisons against `null`
- Conditions and logical negation use strict non-nullable `boolean` values only, with no truthy or falsy coercion
- The `compile` command currently reads the input file, tokenizes it, parses it, checks it, generates C, and compiles it with `clang` or `gcc`
- The generated C currently maps Pulse `string` values to an internal `string_t` runtime struct
- Nullable variables are currently emitted as internal `<base>_nullable` runtime structs in the generated C

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
