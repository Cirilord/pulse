import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Checker } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { ModuleResolver } from '../src/compiler/module-resolver.js';
import { Lexer } from '../src/lexer/lexer.js';
import { Parser } from '../src/parser/parser.js';

describe('c externs example', function describeCExternsExample(): void {
  test('parses examples/c-externs.p with manual C extern imports', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./c-externs.p', import.meta.url), 'utf8');
    const parser: Parser = new Parser(new Lexer(sourceCode).tokenize());
    const program = parser.parseProgram();

    expect(program.body[0]).toMatchObject({
      externDeclarations: [{ kind: 'FunctionDeclaration', isExtern: true, name: { name: 'abs' } }],
      importAll: false,
      isExported: false,
      isExtern: true,
      kind: 'ImportDeclaration',
      namedImports: [],
      namespaceImport: { name: 'CLib' },
      source: 'c:stdlib.h',
    });

    expect(program.body[1]).toMatchObject({
      externDeclarations: [{ kind: 'VariableDeclaration', isExtern: true, name: { name: 'optind' } }],
      importAll: false,
      isExported: false,
      isExtern: true,
      kind: 'ImportDeclaration',
      namedImports: [],
      namespaceImport: { name: 'Unix' },
      source: 'c:unistd.h',
    });
  });

  test('parses star extern imports', function testStarExternParserOutput(): void {
    const sourceCode =
      'import * from "c:stdlib.h" extern {\n' +
      '  fn abs(val value: int): int;\n' +
      '}\n\n' +
      'fn main(): int {\n' +
      '  return abs(-10);\n' +
      '}';
    const parser: Parser = new Parser(new Lexer(sourceCode).tokenize());
    const program = parser.parseProgram();

    expect(program.body[0]).toMatchObject({
      importAll: true,
      isExtern: true,
      namespaceImport: null,
      source: 'c:stdlib.h',
    });
  });

  test('rejects extern imports from non-C sources during parsing', function testInvalidExternSource(): void {
    const sourceCode = 'import Local from "./file" extern {\n' + '  fn abs(val value: int): int;\n' + '}\n';

    expect(function parseInvalidExternImport(): void {
      const parser: Parser = new Parser(new Lexer(sourceCode).tokenize());
      parser.parseProgram();
    }).toThrow('Extern imports are only supported for "c:..." sources.');
  });

  test('checks resolved examples/c-externs.p without semantic errors', async function testCheckerOutput(): Promise<void> {
    const moduleResolver: ModuleResolver = new ModuleResolver();
    const checker: Checker = new Checker();
    const program = await moduleResolver.resolveEntry(new URL('./c-externs.p', import.meta.url).pathname);

    expect(function checkCExternsProgram(): void {
      checker.checkProgram(program);
    }).not.toThrow();
  });

  test('generates C for examples/c-externs.p exactly as expected', async function testCGeneratorOutput(): Promise<void> {
    const moduleResolver: ModuleResolver = new ModuleResolver();
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const expectedCOutput: string = await readFile(new URL('./c-externs.c', import.meta.url), 'utf8');
    const program = await moduleResolver.resolveEntry(new URL('./c-externs.p', import.meta.url).pathname);

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });

  test('rejects duplicate extern declarations inside the same import block', async function testDuplicateExternDeclarations(): Promise<void> {
    const temporaryDirectory: string = await mkdtemp(path.join(os.tmpdir(), 'pulse-externs-'));
    const entryPath: string = path.join(temporaryDirectory, 'duplicate-externs.p');
    const moduleResolver: ModuleResolver = new ModuleResolver();
    const sourceCode: string =
      'import CLib from "c:stdlib.h" extern {\n' +
      '  fn abs(val value: int): int;\n' +
      '  fn abs(val value: int): int;\n' +
      '}\n\n' +
      'fn main(): int {\n' +
      '  return CLib.abs(-10);\n' +
      '}\n';

    await writeFile(entryPath, sourceCode, 'utf8');

    await expect(moduleResolver.resolveEntry(entryPath)).rejects.toThrow(
      'Extern declaration "abs" is already declared.'
    );
  });
});
