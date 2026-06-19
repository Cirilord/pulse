import { readFile } from 'node:fs/promises';

import { wrapInMain } from './test-helpers.js';
import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { Parser } from '../src/parser/parser.js';

describe('errors example', function describeErrorsExample(): void {
  test('parses examples/errors.p with the builtin Error class', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./errors.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const program = parser.parseProgram();

    expect(program.body[0]).toMatchObject({
      kind: 'FunctionDeclaration',
      name: { name: 'buildError' },
      returnType: { kind: 'NamedType', name: 'Error' },
    });

    expect(program.body[1]).toMatchObject({
      kind: 'FunctionDeclaration',
      name: { name: 'main' },
    });
  });

  test('checks examples/errors.p without semantic errors', async function testCheckerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./errors.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkErrorsProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).not.toThrow();
  });

  test('rejects redeclaring the builtin Error class', function testBuiltinErrorRedeclaration(): void {
    const sourceCode = `${wrapInMain('  return 0;')}\n\nclass Error {\n  public val message: string;\n\n  public fn constructor(val message: string) {\n    this.message = message;\n  }\n}`;
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkBuiltinErrorRedeclarationProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('generates C for examples/errors.p exactly as expected', async function testCGeneratorOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./errors.p', import.meta.url), 'utf8');
    const expectedCOutput: string = await readFile(new URL('./errors.c', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });
});
