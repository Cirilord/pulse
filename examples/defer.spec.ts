import { readFile } from 'node:fs/promises';

import { wrapInMain } from './test-helpers.js';
import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';
import type { FunctionDeclarationNode } from '../src/parser/ast/index.js';
import { Parser } from '../src/parser/parser.js';

describe('defer example', function describeDeferExample(): void {
  test('tokenizes examples/defer.p with the defer keyword', async function testLexerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./defer.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const tokens = lexer.tokenize().map(function toTokenShape(token): { lexeme: string; type: TokenType } {
      return {
        lexeme: token.lexeme,
        type: token.type,
      };
    });

    expect(tokens).toContainEqual({ lexeme: 'defer', type: TokenType.Defer });
    expect(tokens).toContainEqual({ lexeme: 'continue', type: TokenType.Continue });
    expect(tokens).toContainEqual({ lexeme: 'break', type: TokenType.Break });
  });

  test('parses examples/defer.p with defer statements in different scopes', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./defer.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const program = parser.parseProgram();
    const runFunction = program.body.find(
      (topLevel): topLevel is FunctionDeclarationNode =>
        topLevel.kind === 'FunctionDeclaration' && topLevel.name.name === 'run'
    );

    expect(runFunction).toBeDefined();
    expect(runFunction?.body.body[0]).toMatchObject({
      kind: 'DeferStatement',
    });
    expect(runFunction?.body.body[1]).toMatchObject({
      kind: 'BlockStatement',
      body: [{ kind: 'DeferStatement' }],
    });
    expect(runFunction?.body.body[3]).toMatchObject({
      kind: 'WhileStatement',
      body: {
        body: expect.arrayContaining([expect.objectContaining({ kind: 'DeferStatement' })]),
      },
    });
  });

  test('checks examples/defer.p without semantic errors', async function testCheckerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./defer.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkDeferProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).not.toThrow();
  });

  test('rejects defer statements without a call expression', function testInvalidDeferExpression(): void {
    const sourceCode = wrapInMain('  val value: int = 1;\n  defer value;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidDeferProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('generates C for examples/defer.p exactly as expected', async function testCGeneratorOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./defer.p', import.meta.url), 'utf8');
    const expectedCOutput: string = await readFile(new URL('./defer.c', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });
});
