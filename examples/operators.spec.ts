import { readFile } from 'node:fs/promises';

import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';
import { Parser } from '../src/parser/parser.js';

describe('operators example', function describeOperatorsExample(): void {
  test('tokenizes examples/operators.p with comparison, logical, unary, and compound operators', async function testLexerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./operators.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const tokens = lexer.tokenize().map(function toTokenShape(token): { lexeme: string; type: TokenType } {
      return {
        lexeme: token.lexeme,
        type: token.type,
      };
    });

    expect(tokens).toContainEqual({ lexeme: '==', type: TokenType.EqualEqual });
    expect(tokens).toContainEqual({ lexeme: '!=', type: TokenType.BangEqual });
    expect(tokens).toContainEqual({ lexeme: '<', type: TokenType.LessThan });
    expect(tokens).toContainEqual({ lexeme: '<=', type: TokenType.LessThanEqual });
    expect(tokens).toContainEqual({ lexeme: '>', type: TokenType.GreaterThan });
    expect(tokens).toContainEqual({ lexeme: '>=', type: TokenType.GreaterThanEqual });
    expect(tokens).toContainEqual({ lexeme: '&&', type: TokenType.AmpersandAmpersand });
    expect(tokens).toContainEqual({ lexeme: '||', type: TokenType.PipePipe });
    expect(tokens).toContainEqual({ lexeme: '!', type: TokenType.Bang });
    expect(tokens).toContainEqual({ lexeme: '??', type: TokenType.QuestionMarkQuestionMark });
    expect(tokens).toContainEqual({ lexeme: '&&=', type: TokenType.AmpersandAmpersandEqual });
    expect(tokens).toContainEqual({ lexeme: '||=', type: TokenType.PipePipeEqual });
    expect(tokens).toContainEqual({ lexeme: '??=', type: TokenType.QuestionMarkQuestionMarkEqual });
  });

  test('parses comparison, logical, and unary expressions', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./operators.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const program = parser.parseProgram();

    expect(program.body[0]).toMatchObject({
      initializer: {
        kind: 'BinaryExpression',
        operator: '==',
      },
    });

    expect(program.body[6]).toMatchObject({
      initializer: {
        kind: 'BinaryExpression',
        operator: '&&',
      },
    });

    expect(program.body[8]).toMatchObject({
      initializer: {
        kind: 'UnaryExpression',
        operator: '!',
      },
    });

    expect(program.body[12]).toMatchObject({
      expression: {
        kind: 'AssignmentExpression',
        operator: '||=',
      },
      kind: 'ExpressionStatement',
    });

    expect(program.body[13]).toMatchObject({
      expression: {
        kind: 'AssignmentExpression',
        operator: '&&=',
      },
      kind: 'ExpressionStatement',
    });

    expect(program.body[15]).toMatchObject({
      expression: {
        kind: 'AssignmentExpression',
        operator: '??=',
      },
      kind: 'ExpressionStatement',
    });

    expect(program.body[16]).toMatchObject({
      initializer: {
        kind: 'BinaryExpression',
        operator: '??',
      },
    });
  });

  test('checks examples/operators.p without semantic errors', async function testCheckerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./operators.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkOperatorsProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).not.toThrow();
  });

  test('rejects logical operators on numeric values', function testInvalidLogicalOperands(): void {
    const sourceCode = 'val invalid: boolean = 1 && 2;';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidLogicalProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects comparison across mismatched numeric types', function testInvalidComparisonOperands(): void {
    const sourceCode = 'val invalid: boolean = 1 < 2.5;';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidComparisonProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects null coalescing on a non-nullable left operand', function testInvalidNullCoalescingLeftOperand(): void {
    const sourceCode = 'val name: string = "Pulse"; val fallback: string = name ?? "guest";';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidNullCoalescingLeftOperandProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects null coalescing across mismatched types', function testInvalidNullCoalescingTypes(): void {
    const sourceCode = 'val alias: string? = null; val fallback: string = alias ?? 1;';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidNullCoalescingTypesProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects logical compound assignment on non-boolean variables', function testInvalidLogicalCompoundAssignment(): void {
    const sourceCode = 'var count: int = 1; count ||= 2;';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidLogicalCompoundAssignmentProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects null coalescing assignment on non-nullable variables', function testInvalidNullCoalescingAssignment(): void {
    const sourceCode = 'var name: string = "Pulse"; name ??= "guest";';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidNullCoalescingAssignmentProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('generates C for examples/operators.p exactly as expected', async function testCGeneratorOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./operators.p', import.meta.url), 'utf8');
    const expectedCOutput: string = await readFile(new URL('./operators.c', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });
});
