import { readFile } from 'node:fs/promises';

import { Checker } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { ModuleResolver } from '../src/compiler/module-resolver.js';
import { Lexer } from '../src/lexer/lexer.js';
import { Parser } from '../src/parser/parser.js';

describe('imports example', function describeImportsExample(): void {
  test('parses examples/imports.p with local Pulse imports', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./imports.p', import.meta.url), 'utf8');
    const parser: Parser = new Parser(new Lexer(sourceCode).tokenize());
    const program = parser.parseProgram();

    expect(program.body[0]).toMatchObject({
      importAll: false,
      isExported: false,
      kind: 'ImportDeclaration',
      namedImports: [{ name: 'importedText' }, { name: 'logImportedText' }, { name: 'ImportedValue' }],
      namespaceImport: { name: 'File1' },
      source: './imports-file1',
    });

    expect(program.body[1]).toMatchObject({
      importAll: false,
      isExported: false,
      kind: 'ImportDeclaration',
      namedImports: [{ name: 'createImportedValue' }, { name: 'extraValue' }, { name: 'increment' }],
      namespaceImport: null,
      source: './imports-barrel',
    });
  });

  test('parses examples/imports-barrel.p with reexports', async function testReexportParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./imports-barrel.p', import.meta.url), 'utf8');
    const parser: Parser = new Parser(new Lexer(sourceCode).tokenize());
    const program = parser.parseProgram();

    expect(program.body[0]).toMatchObject({
      importAll: false,
      isExported: true,
      kind: 'ImportDeclaration',
      namedImports: [
        { name: 'importedText' },
        { name: 'logImportedText' },
        { name: 'ImportedValue' },
        { name: 'createImportedValue' },
      ],
      namespaceImport: null,
      source: './imports-file1',
    });

    expect(program.body[1]).toMatchObject({
      importAll: true,
      isExported: true,
      kind: 'ImportDeclaration',
      namedImports: [],
      namespaceImport: null,
      source: './imports-extra',
    });
  });

  test('checks resolved examples/imports.p without semantic errors', async function testCheckerOutput(): Promise<void> {
    const moduleResolver: ModuleResolver = new ModuleResolver();
    const checker: Checker = new Checker();
    const program = await moduleResolver.resolveEntry(new URL('./imports.p', import.meta.url).pathname);

    expect(function checkImportsProgram(): void {
      checker.checkProgram(program);
    }).not.toThrow();
  });

  test('generates C for examples/imports.p exactly as expected', async function testCGeneratorOutput(): Promise<void> {
    const moduleResolver: ModuleResolver = new ModuleResolver();
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const expectedCOutput: string = await readFile(new URL('./imports.c', import.meta.url), 'utf8');
    const program = await moduleResolver.resolveEntry(new URL('./imports.p', import.meta.url).pathname);

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });
});
