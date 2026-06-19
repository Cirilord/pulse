import { readFile } from 'node:fs/promises';

import { getMainStatements, wrapInMain } from './test-helpers.js';
import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { Parser } from '../src/parser/parser.js';

describe('blocks example', function describeBlocksExample(): void {
  test('parses examples/blocks.p with a block statement inside main', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./blocks.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());

    expect(getMainStatements(parser.parseProgram())[1]).toMatchObject({
      body: [{ kind: 'VariableDeclaration' }, { kind: 'VariableDeclaration' }, { kind: 'ExpressionStatement' }],
      kind: 'BlockStatement',
    });
  });

  test('checks examples/blocks.p without semantic errors', async function testCheckerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./blocks.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkBlocksProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).not.toThrow();
  });

  test('rejects duplicate declarations in the same block scope', function testInvalidDuplicateDeclaration(): void {
    const sourceCode = wrapInMain('  { val a: int = 1; val a: int = 2; }');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidDuplicateDeclarationProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('generates C for examples/blocks.p exactly as expected', async function testCGeneratorOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./blocks.p', import.meta.url), 'utf8');
    const expectedCOutput: string = await readFile(new URL('./blocks.c', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });
});
