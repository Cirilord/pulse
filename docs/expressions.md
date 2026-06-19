# Expressions

This document tracks the current expression rules in Pulse.

## Operators

- Numeric expressions support `+`, `-`, `*`, `/`, and `%`
- Unary `+` and unary `-` are available for numeric expressions
- Comparison operators `==`, `!=`, `<`, `<=`, `>`, and `>=` are available
- Bitwise operators `&`, `|`, `^`, `<<`, `>>`, and `~` are available for `int` and `byte`
- Logical operators `&&`, `||`, and `!` are available for boolean expressions
- Compound assignments `&&=`, `||=`, and `??=` are available for compatible boolean and nullable variables
- Parentheses can be used to group expressions and control precedence

## Nullable Expressions

- Nullable values can be compared with `==` and `!=`
- Ordered comparisons do not accept nullable operands
- `name == null` and `name != null` are valid when `name` is nullable
- `a == b` and `a != b` are valid when both operands use the same nullable type
- Null coalescing with `??` is available for nullable values and `null` literals

## Conditional Expressions

- Conditional expressions `condition ? whenTrue : whenFalse` are available when the condition is a non-nullable `boolean` and both branches resolve to the same type
