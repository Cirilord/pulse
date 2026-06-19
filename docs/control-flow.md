# Control Flow

This document tracks the current control flow and block rules in Pulse.

## Conditions

- `if`, `elif`, and `else` conditions require a non-nullable `boolean`
- `while`, `do while`, and `for` conditions require a non-nullable `boolean`
- Pulse does not use truthy or falsy coercion for conditions or logical negation
- Values such as `0`, `""`, `null`, and `boolean?` must be compared explicitly instead of being treated as booleans

## Loops

- `while` loops are supported
- `do while` loops are supported
- Classic `for` loops are supported in the form `for (initializer; condition; update) { ... }`
- `break` can only be used inside a loop
- `continue` can only be used inside a loop

## Blocks

- Block scopes allow variable shadowing, so an inner block may declare a new variable with the same name as an outer declaration
- The `for` initializer scope is available to the loop condition, loop update, and loop body
