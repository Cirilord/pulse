import { readFile } from 'node:fs/promises';

import { getMainFunction, getMainStatements, wrapInMain } from './test-helpers.js';
import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';
import { Parser } from '../src/parser/parser.js';

describe('functions example', function describeFunctionsExample(): void {
  test('tokenizes examples/functions.p with function keywords', async function testLexerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./functions.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const tokens = lexer.tokenize().map(function toTokenShape(token): { lexeme: string; type: TokenType } {
      return {
        lexeme: token.lexeme,
        type: token.type,
      };
    });

    expect(tokens).toContainEqual({ lexeme: 'fn', type: TokenType.Fn });
    expect(tokens).toContainEqual({ lexeme: 'return', type: TokenType.Return });
  });

  test('parses examples/functions.p with function declarations and calls', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./functions.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const program = parser.parseProgram();

    expect(program.body[0]).toMatchObject({
      kind: 'FunctionDeclaration',
      name: { name: 'sum' },
      parameters: [{ name: { name: 'a' } }, { name: { name: 'b' } }],
      returnType: { kind: 'NamedType', name: 'int' },
    });

    expect(getMainFunction(program)).toMatchObject({
      kind: 'FunctionDeclaration',
      name: { name: 'main' },
      returnType: { kind: 'NamedType', name: 'int' },
    });

    expect(getMainStatements(program)[0]).toMatchObject({
      initializer: {
        kind: 'CallExpression',
      },
      kind: 'VariableDeclaration',
      name: { name: 'result' },
    });
  });

  test('checks examples/functions.p without semantic errors', async function testCheckerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./functions.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkFunctionsProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).not.toThrow();
  });

  test('rejects functions without an explicit final return', function testMissingReturn(): void {
    const sourceCode = `${wrapInMain('  return 0;')}\n\nfn sum(a: int, b: int): int { val result: int = a + b; }`;
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkMissingReturnProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects void functions that return a value', function testVoidReturnValue(): void {
    const sourceCode = `${wrapInMain('  return 0;')}\n\nfn logValue(value: int): void { return value; }`;
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkVoidReturnValueProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('generates C for examples/functions.p exactly as expected', async function testCGeneratorOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./functions.p', import.meta.url), 'utf8');
    const expectedCOutput: string = await readFile(new URL('./functions.c', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });
});
