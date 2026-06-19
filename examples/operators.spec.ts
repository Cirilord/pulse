import { readFile } from 'node:fs/promises';

import { getMainStatements, wrapInMain } from './test-helpers.js';
import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';
import { Parser } from '../src/parser/parser.js';

describe('operators example', function describeOperatorsExample(): void {
  test('tokenizes examples/operators.p with comparison, logical, unary, compound, and conditional operators', async function testLexerOutput(): Promise<void> {
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
    expect(tokens).toContainEqual({ lexeme: '?', type: TokenType.QuestionMark });
    expect(tokens).toContainEqual({ lexeme: ':', type: TokenType.Colon });
  });

  test('parses comparison, logical, unary, and nullable equality expressions inside main', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./operators.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const statements = getMainStatements(parser.parseProgram());

    expect(statements[0]).toMatchObject({
      initializer: {
        kind: 'BinaryExpression',
        operator: '==',
      },
    });

    expect(statements[6]).toMatchObject({
      initializer: {
        kind: 'BinaryExpression',
        operator: '&&',
      },
    });

    expect(statements[8]).toMatchObject({
      initializer: {
        kind: 'UnaryExpression',
        operator: '!',
      },
    });

    expect(statements[12]).toMatchObject({
      expression: {
        kind: 'AssignmentExpression',
        operator: '||=',
      },
      kind: 'ExpressionStatement',
    });

    expect(statements[13]).toMatchObject({
      expression: {
        kind: 'AssignmentExpression',
        operator: '&&=',
      },
      kind: 'ExpressionStatement',
    });

    expect(statements[14]).toMatchObject({
      initializer: {
        kind: 'ConditionalExpression',
      },
    });

    expect(statements[16]).toMatchObject({
      initializer: {
        kind: 'BinaryExpression',
        operator: '==',
      },
    });

    expect(statements[19]).toMatchObject({
      initializer: {
        kind: 'BinaryExpression',
        operator: '==',
      },
    });

    expect(statements[22]).toMatchObject({
      expression: {
        kind: 'AssignmentExpression',
        operator: '??=',
      },
      kind: 'ExpressionStatement',
    });

    expect(statements[23]).toMatchObject({
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
    const sourceCode = wrapInMain('  val invalid: boolean = 1 && 2;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidLogicalProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects comparison across mismatched numeric types', function testInvalidComparisonOperands(): void {
    const sourceCode = wrapInMain('  val invalid: boolean = 1 < 2.5;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidComparisonProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects ordered comparisons with nullable operands', function testInvalidNullableOrderedComparison(): void {
    const sourceCode = wrapInMain(
      '  var left: int? = null;\n  var right: int? = null;\n  val invalid: boolean = left < right;'
    );
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidNullableOrderedComparisonProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects equality between nullable and non-nullable operands', function testInvalidNullableEqualityOperands(): void {
    const sourceCode = wrapInMain('  var left: int? = null;\n  val invalid: boolean = left == 1;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidNullableEqualityOperandsProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects null coalescing on a non-nullable left operand', function testInvalidNullCoalescingLeftOperand(): void {
    const sourceCode = wrapInMain('  val name: string = "Pulse";\n  val fallback: string = name ?? "guest";');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidNullCoalescingLeftOperandProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects null coalescing across mismatched types', function testInvalidNullCoalescingTypes(): void {
    const sourceCode = wrapInMain('  val alias: string? = null;\n  val fallback: string = alias ?? 1;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidNullCoalescingTypesProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects logical compound assignment on non-boolean variables', function testInvalidLogicalCompoundAssignment(): void {
    const sourceCode = wrapInMain('  var count: int = 1;\n  count ||= 2;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidLogicalCompoundAssignmentProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects null coalescing assignment on non-nullable variables', function testInvalidNullCoalescingAssignment(): void {
    const sourceCode = wrapInMain('  var name: string = "Pulse";\n  name ??= "guest";');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidNullCoalescingAssignmentProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects conditional expressions with non-boolean conditions', function testInvalidConditionalCondition(): void {
    const sourceCode = wrapInMain('  val invalid: int = 1 ? 2 : 3;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidConditionalConditionProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects conditional expressions with nullable boolean conditions', function testInvalidNullableConditionalCondition(): void {
    const sourceCode = wrapInMain('  var flag: boolean? = null;\n  val invalid: boolean = flag ? true : false;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidNullableConditionalConditionProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects conditional expressions with mismatched branch types', function testInvalidConditionalBranches(): void {
    const sourceCode = wrapInMain('  val invalid: int = true ? 1 : "Pulse";');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidConditionalBranchesProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects unary not on numeric and nullable operands', function testInvalidUnaryNotOperands(): void {
    const sourcePrograms: string[] = [
      wrapInMain('  val invalid: boolean = !0;'),
      wrapInMain('  val invalid: boolean = !"";'),
      wrapInMain('  val flag: boolean? = null;\n  val invalid: boolean = !flag;'),
      wrapInMain('  val invalid: boolean = !null;'),
    ];

    for (const sourceCode of sourcePrograms) {
      const lexer: Lexer = new Lexer(sourceCode);
      const parser: Parser = new Parser(lexer.tokenize());
      const checker: Checker = new Checker();

      expect(function checkInvalidUnaryNotOperandsProgram(): void {
        checker.checkProgram(parser.parseProgram());
      }).toThrow(CheckerError);
    }
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
