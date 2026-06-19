import { readFile } from 'node:fs/promises';

import { getMainStatements, wrapInMain } from './test-helpers.js';
import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';
import { Parser } from '../src/parser/parser.js';

describe('arithmetic example', function describeArithmeticExample(): void {
  test('tokenizes examples/arithmetic.p with arithmetic and compound assignment operators', async function testLexerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./arithmetic.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const tokens = lexer.tokenize().map(function toTokenShape(token): { lexeme: string; type: TokenType } {
      return {
        lexeme: token.lexeme,
        type: token.type,
      };
    });

    expect(tokens).toContainEqual({ lexeme: 'fn', type: TokenType.Fn });
    expect(tokens).toContainEqual({ lexeme: '+=', type: TokenType.PlusEqual });
    expect(tokens).toContainEqual({ lexeme: '-=', type: TokenType.MinusEqual });
    expect(tokens).toContainEqual({ lexeme: '*=', type: TokenType.StarEqual });
    expect(tokens).toContainEqual({ lexeme: '%=', type: TokenType.PercentEqual });
    expect(tokens).toContainEqual({ lexeme: '/=', type: TokenType.SlashEqual });
  });

  test('parses arithmetic expressions and assignment statements inside main', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./arithmetic.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const statements = getMainStatements(parser.parseProgram());

    expect(statements[1]).toMatchObject({
      initializer: {
        kind: 'BinaryExpression',
        left: {
          kind: 'IdentifierExpression',
          name: 'a',
        },
        operator: '+',
        right: {
          kind: 'IntegerLiteral',
          value: 5,
        },
      },
      kind: 'VariableDeclaration',
      mutability: 'val',
      name: {
        name: 'b',
      },
    });

    expect(statements[4]).toMatchObject({
      expression: {
        kind: 'AssignmentExpression',
        operator: '+=',
        target: {
          kind: 'IdentifierExpression',
          name: 'x',
        },
        value: {
          kind: 'IntegerLiteral',
          value: 5,
        },
      },
      kind: 'ExpressionStatement',
    });
  });

  test('checks examples/arithmetic.p without semantic errors', async function testCheckerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./arithmetic.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkArithmeticProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).not.toThrow();
  });

  test('rejects compound assignment on immutable values', function testImmutableCompoundAssignment(): void {
    const sourceCode = wrapInMain('  val x: int = 1;\n  x += 1;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkImmutableAssignment(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects unknown identifiers in arithmetic expressions', function testUnknownIdentifier(): void {
    const sourceCode = wrapInMain('  val x: int = missing + 1;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkUnknownIdentifierProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('generates C for examples/arithmetic.p exactly as expected', async function testCGeneratorOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./arithmetic.p', import.meta.url), 'utf8');
    const expectedCOutput: string = await readFile(new URL('./arithmetic.c', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });
});
