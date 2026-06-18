# Pulse

A programming language project built in TypeScript.
This README should be kept up to date as the project evolves.

## Documentation

- `docs/language.md` for the general language overview
- `docs/variables.md` for variable and nullability rules

## Project Status

- A basic lexer foundation is available in `src/lexer`
- A basic parser foundation is available in `src/parser`
- The `compile` command currently reads the input file, tokenizes it, parses it, and prints the AST

## Setup

```bash
yarn install
```

## Usage

```bash
yarn start:dev compile examples/variables.p
```

## Tests

```bash
yarn test
```
