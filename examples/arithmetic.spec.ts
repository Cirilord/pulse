import { readFile } from 'node:fs/promises';

import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';
import { Parser } from '../src/parser/parser.js';

describe('arithmetic example', function describeArithmeticExample(): void {
  test('tokenizes examples/arithmetic.p with arithmetic and compound assignment operators', async function testLexerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./arithmetic.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);

    expect(
      lexer.tokenize().map(function toTokenShape(token): { lexeme: string; type: TokenType } {
        return {
          lexeme: token.lexeme,
          type: token.type,
        };
      })
    ).toStrictEqual([
      { lexeme: 'val', type: TokenType.Val },
      { lexeme: 'a', type: TokenType.Identifier },
      { lexeme: ':', type: TokenType.Colon },
      { lexeme: 'int', type: TokenType.Identifier },
      { lexeme: '=', type: TokenType.Equal },
      { lexeme: '30', type: TokenType.IntegerLiteral },
      { lexeme: ';', type: TokenType.Semicolon },
      { lexeme: 'val', type: TokenType.Val },
      { lexeme: 'b', type: TokenType.Identifier },
      { lexeme: ':', type: TokenType.Colon },
      { lexeme: 'int', type: TokenType.Identifier },
      { lexeme: '=', type: TokenType.Equal },
      { lexeme: 'a', type: TokenType.Identifier },
      { lexeme: '+', type: TokenType.Plus },
      { lexeme: '5', type: TokenType.IntegerLiteral },
      { lexeme: ';', type: TokenType.Semicolon },
      { lexeme: 'val', type: TokenType.Val },
      { lexeme: 'c', type: TokenType.Identifier },
      { lexeme: ':', type: TokenType.Colon },
      { lexeme: 'int', type: TokenType.Identifier },
      { lexeme: '=', type: TokenType.Equal },
      { lexeme: '30', type: TokenType.IntegerLiteral },
      { lexeme: '+', type: TokenType.Plus },
      { lexeme: '5', type: TokenType.IntegerLiteral },
      { lexeme: ';', type: TokenType.Semicolon },
      { lexeme: 'var', type: TokenType.Var },
      { lexeme: 'x', type: TokenType.Identifier },
      { lexeme: ':', type: TokenType.Colon },
      { lexeme: 'int', type: TokenType.Identifier },
      { lexeme: '=', type: TokenType.Equal },
      { lexeme: '0', type: TokenType.IntegerLiteral },
      { lexeme: ';', type: TokenType.Semicolon },
      { lexeme: 'x', type: TokenType.Identifier },
      { lexeme: '+=', type: TokenType.PlusEqual },
      { lexeme: '5', type: TokenType.IntegerLiteral },
      { lexeme: ';', type: TokenType.Semicolon },
      { lexeme: 'x', type: TokenType.Identifier },
      { lexeme: '-=', type: TokenType.MinusEqual },
      { lexeme: '2', type: TokenType.IntegerLiteral },
      { lexeme: ';', type: TokenType.Semicolon },
      { lexeme: 'x', type: TokenType.Identifier },
      { lexeme: '*=', type: TokenType.StarEqual },
      { lexeme: '3', type: TokenType.IntegerLiteral },
      { lexeme: ';', type: TokenType.Semicolon },
      { lexeme: 'x', type: TokenType.Identifier },
      { lexeme: '%=', type: TokenType.PercentEqual },
      { lexeme: '5', type: TokenType.IntegerLiteral },
      { lexeme: ';', type: TokenType.Semicolon },
      { lexeme: 'x', type: TokenType.Identifier },
      { lexeme: '/=', type: TokenType.SlashEqual },
      { lexeme: '2', type: TokenType.IntegerLiteral },
      { lexeme: ';', type: TokenType.Semicolon },
      { lexeme: '', type: TokenType.EOF },
    ]);
  });

  test('parses arithmetic expressions and assignment statements', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./arithmetic.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const program = parser.parseProgram();

    expect(program.body).toHaveLength(9);

    expect(program.body[1]).toMatchObject({
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

    expect(program.body[4]).toMatchObject({
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
    const sourceCode = 'val x: int = 1;\nx += 1;';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkImmutableAssignment(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects unknown identifiers in arithmetic expressions', function testUnknownIdentifier(): void {
    const sourceCode = 'val x: int = missing + 1;';
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
