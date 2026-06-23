import { readFile } from 'node:fs/promises';

import { Checker } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { ModuleResolver } from '../src/compiler/module-resolver.js';
import { Lexer } from '../src/lexer/lexer.js';
import { Parser } from '../src/parser/parser.js';

describe('c imports example', function describeCImportsExample(): void {
  test('parses examples/c-imports.p with cataloged C imports', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./c-imports.p', import.meta.url), 'utf8');
    const parser: Parser = new Parser(new Lexer(sourceCode).tokenize());
    const program = parser.parseProgram();

    expect(program.body[0]).toMatchObject({
      importAll: false,
      isExported: false,
      kind: 'ImportDeclaration',
      namedImports: [{ name: 'abs' }],
      namespaceImport: { name: 'CStd' },
      source: 'c:stdlib.h',
    });
  });

  test('checks resolved examples/c-imports.p without semantic errors', async function testCheckerOutput(): Promise<void> {
    const moduleResolver: ModuleResolver = new ModuleResolver();
    const checker: Checker = new Checker();
    const program = await moduleResolver.resolveEntry(new URL('./c-imports.p', import.meta.url).pathname);

    expect(function checkCImportsProgram(): void {
      checker.checkProgram(program);
    }).not.toThrow();
  });

  test('generates C for examples/c-imports.p exactly as expected', async function testCGeneratorOutput(): Promise<void> {
    const moduleResolver: ModuleResolver = new ModuleResolver();
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const expectedCOutput: string = await readFile(new URL('./c-imports.c', import.meta.url), 'utf8');
    const program = await moduleResolver.resolveEntry(new URL('./c-imports.p', import.meta.url).pathname);

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });
});
