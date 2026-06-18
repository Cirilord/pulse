import { readFile } from 'node:fs/promises';

import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator, CGeneratorError } from '../src/codegen/c-generator.js';
import { getDefaultBinaryOutputPath, getDefaultCOutputPath } from '../src/compiler/c-compiler.js';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';
import { Parser } from '../src/parser/parser.js';

describe('variables example', function describeVariablesExample(): void {
  test('tokenizes examples/variables.p exactly as expected', async function testLexerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./variables.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);

    expect(lexer.tokenize()).toStrictEqual([
      { lexeme: 'var', location: { end: { column: 4, line: 1 }, start: { column: 1, line: 1 } }, type: TokenType.Var },
      {
        lexeme: 'a',
        location: { end: { column: 6, line: 1 }, start: { column: 5, line: 1 } },
        type: TokenType.Identifier,
      },
      { lexeme: ':', location: { end: { column: 7, line: 1 }, start: { column: 6, line: 1 } }, type: TokenType.Colon },
      {
        lexeme: 'int',
        location: { end: { column: 11, line: 1 }, start: { column: 8, line: 1 } },
        type: TokenType.Identifier,
      },
      {
        lexeme: '=',
        location: { end: { column: 13, line: 1 }, start: { column: 12, line: 1 } },
        type: TokenType.Equal,
      },
      {
        lexeme: '30',
        location: { end: { column: 16, line: 1 }, start: { column: 14, line: 1 } },
        type: TokenType.IntegerLiteral,
      },
      {
        lexeme: ';',
        location: { end: { column: 17, line: 1 }, start: { column: 16, line: 1 } },
        type: TokenType.Semicolon,
      },
      { lexeme: 'val', location: { end: { column: 4, line: 2 }, start: { column: 1, line: 2 } }, type: TokenType.Val },
      {
        lexeme: 'b',
        location: { end: { column: 6, line: 2 }, start: { column: 5, line: 2 } },
        type: TokenType.Identifier,
      },
      { lexeme: ':', location: { end: { column: 7, line: 2 }, start: { column: 6, line: 2 } }, type: TokenType.Colon },
      {
        lexeme: 'string',
        location: { end: { column: 14, line: 2 }, start: { column: 8, line: 2 } },
        type: TokenType.Identifier,
      },
      {
        lexeme: '=',
        location: { end: { column: 16, line: 2 }, start: { column: 15, line: 2 } },
        type: TokenType.Equal,
      },
      {
        lexeme: '"Test"',
        location: { end: { column: 23, line: 2 }, start: { column: 17, line: 2 } },
        type: TokenType.StringLiteral,
      },
      {
        lexeme: ';',
        location: { end: { column: 24, line: 2 }, start: { column: 23, line: 2 } },
        type: TokenType.Semicolon,
      },
      { lexeme: 'var', location: { end: { column: 4, line: 3 }, start: { column: 1, line: 3 } }, type: TokenType.Var },
      {
        lexeme: 'c',
        location: { end: { column: 6, line: 3 }, start: { column: 5, line: 3 } },
        type: TokenType.Identifier,
      },
      { lexeme: ':', location: { end: { column: 7, line: 3 }, start: { column: 6, line: 3 } }, type: TokenType.Colon },
      {
        lexeme: 'byte',
        location: { end: { column: 12, line: 3 }, start: { column: 8, line: 3 } },
        type: TokenType.Identifier,
      },
      {
        lexeme: '=',
        location: { end: { column: 14, line: 3 }, start: { column: 13, line: 3 } },
        type: TokenType.Equal,
      },
      {
        lexeme: '255',
        location: { end: { column: 18, line: 3 }, start: { column: 15, line: 3 } },
        type: TokenType.IntegerLiteral,
      },
      {
        lexeme: ';',
        location: { end: { column: 19, line: 3 }, start: { column: 18, line: 3 } },
        type: TokenType.Semicolon,
      },
      { lexeme: 'val', location: { end: { column: 4, line: 4 }, start: { column: 1, line: 4 } }, type: TokenType.Val },
      {
        lexeme: 'd',
        location: { end: { column: 6, line: 4 }, start: { column: 5, line: 4 } },
        type: TokenType.Identifier,
      },
      { lexeme: ':', location: { end: { column: 7, line: 4 }, start: { column: 6, line: 4 } }, type: TokenType.Colon },
      {
        lexeme: 'double',
        location: { end: { column: 14, line: 4 }, start: { column: 8, line: 4 } },
        type: TokenType.Identifier,
      },
      {
        lexeme: '=',
        location: { end: { column: 16, line: 4 }, start: { column: 15, line: 4 } },
        type: TokenType.Equal,
      },
      {
        lexeme: '42.5',
        location: { end: { column: 21, line: 4 }, start: { column: 17, line: 4 } },
        type: TokenType.DoubleLiteral,
      },
      {
        lexeme: ';',
        location: { end: { column: 22, line: 4 }, start: { column: 21, line: 4 } },
        type: TokenType.Semicolon,
      },
      { lexeme: 'var', location: { end: { column: 4, line: 5 }, start: { column: 1, line: 5 } }, type: TokenType.Var },
      {
        lexeme: 'e',
        location: { end: { column: 6, line: 5 }, start: { column: 5, line: 5 } },
        type: TokenType.Identifier,
      },
      { lexeme: ':', location: { end: { column: 7, line: 5 }, start: { column: 6, line: 5 } }, type: TokenType.Colon },
      {
        lexeme: 'boolean',
        location: { end: { column: 15, line: 5 }, start: { column: 8, line: 5 } },
        type: TokenType.Identifier,
      },
      {
        lexeme: '=',
        location: { end: { column: 17, line: 5 }, start: { column: 16, line: 5 } },
        type: TokenType.Equal,
      },
      {
        lexeme: 'true',
        location: { end: { column: 22, line: 5 }, start: { column: 18, line: 5 } },
        type: TokenType.True,
      },
      {
        lexeme: ';',
        location: { end: { column: 23, line: 5 }, start: { column: 22, line: 5 } },
        type: TokenType.Semicolon,
      },
      { lexeme: 'val', location: { end: { column: 4, line: 6 }, start: { column: 1, line: 6 } }, type: TokenType.Val },
      {
        lexeme: 'f',
        location: { end: { column: 6, line: 6 }, start: { column: 5, line: 6 } },
        type: TokenType.Identifier,
      },
      { lexeme: ':', location: { end: { column: 7, line: 6 }, start: { column: 6, line: 6 } }, type: TokenType.Colon },
      {
        lexeme: 'float',
        location: { end: { column: 13, line: 6 }, start: { column: 8, line: 6 } },
        type: TokenType.Identifier,
      },
      {
        lexeme: '=',
        location: { end: { column: 15, line: 6 }, start: { column: 14, line: 6 } },
        type: TokenType.Equal,
      },
      {
        lexeme: '12.25',
        location: { end: { column: 21, line: 6 }, start: { column: 16, line: 6 } },
        type: TokenType.DoubleLiteral,
      },
      {
        lexeme: ';',
        location: { end: { column: 22, line: 6 }, start: { column: 21, line: 6 } },
        type: TokenType.Semicolon,
      },
      { lexeme: '', location: { end: { column: 1, line: 7 }, start: { column: 1, line: 7 } }, type: TokenType.EOF },
    ]);
  });

  test('parses examples/variables.p exactly as expected', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./variables.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());

    expect(parser.parseProgram()).toStrictEqual({
      body: [
        {
          initializer: {
            kind: 'IntegerLiteral',
            location: { end: { column: 16, line: 1 }, start: { column: 14, line: 1 } },
            value: 30,
          },
          kind: 'VariableDeclaration',
          location: { end: { column: 17, line: 1 }, start: { column: 1, line: 1 } },
          mutability: 'var',
          name: {
            kind: 'Identifier',
            location: { end: { column: 6, line: 1 }, start: { column: 5, line: 1 } },
            name: 'a',
          },
          type: {
            kind: 'NamedType',
            location: { end: { column: 11, line: 1 }, start: { column: 8, line: 1 } },
            name: 'int',
          },
        },
        {
          initializer: {
            kind: 'StringLiteral',
            location: { end: { column: 23, line: 2 }, start: { column: 17, line: 2 } },
            value: 'Test',
          },
          kind: 'VariableDeclaration',
          location: { end: { column: 24, line: 2 }, start: { column: 1, line: 2 } },
          mutability: 'val',
          name: {
            kind: 'Identifier',
            location: { end: { column: 6, line: 2 }, start: { column: 5, line: 2 } },
            name: 'b',
          },
          type: {
            kind: 'NamedType',
            location: { end: { column: 14, line: 2 }, start: { column: 8, line: 2 } },
            name: 'string',
          },
        },
        {
          initializer: {
            kind: 'IntegerLiteral',
            location: { end: { column: 18, line: 3 }, start: { column: 15, line: 3 } },
            value: 255,
          },
          kind: 'VariableDeclaration',
          location: { end: { column: 19, line: 3 }, start: { column: 1, line: 3 } },
          mutability: 'var',
          name: {
            kind: 'Identifier',
            location: { end: { column: 6, line: 3 }, start: { column: 5, line: 3 } },
            name: 'c',
          },
          type: {
            kind: 'NamedType',
            location: { end: { column: 12, line: 3 }, start: { column: 8, line: 3 } },
            name: 'byte',
          },
        },
        {
          initializer: {
            kind: 'DoubleLiteral',
            location: { end: { column: 21, line: 4 }, start: { column: 17, line: 4 } },
            value: 42.5,
          },
          kind: 'VariableDeclaration',
          location: { end: { column: 22, line: 4 }, start: { column: 1, line: 4 } },
          mutability: 'val',
          name: {
            kind: 'Identifier',
            location: { end: { column: 6, line: 4 }, start: { column: 5, line: 4 } },
            name: 'd',
          },
          type: {
            kind: 'NamedType',
            location: { end: { column: 14, line: 4 }, start: { column: 8, line: 4 } },
            name: 'double',
          },
        },
        {
          initializer: {
            kind: 'BooleanLiteral',
            location: { end: { column: 22, line: 5 }, start: { column: 18, line: 5 } },
            value: true,
          },
          kind: 'VariableDeclaration',
          location: { end: { column: 23, line: 5 }, start: { column: 1, line: 5 } },
          mutability: 'var',
          name: {
            kind: 'Identifier',
            location: { end: { column: 6, line: 5 }, start: { column: 5, line: 5 } },
            name: 'e',
          },
          type: {
            kind: 'NamedType',
            location: { end: { column: 15, line: 5 }, start: { column: 8, line: 5 } },
            name: 'boolean',
          },
        },
        {
          initializer: {
            kind: 'DoubleLiteral',
            location: { end: { column: 21, line: 6 }, start: { column: 16, line: 6 } },
            value: 12.25,
          },
          kind: 'VariableDeclaration',
          location: { end: { column: 22, line: 6 }, start: { column: 1, line: 6 } },
          mutability: 'val',
          name: {
            kind: 'Identifier',
            location: { end: { column: 6, line: 6 }, start: { column: 5, line: 6 } },
            name: 'f',
          },
          type: {
            kind: 'NamedType',
            location: { end: { column: 13, line: 6 }, start: { column: 8, line: 6 } },
            name: 'float',
          },
        },
      ],
      kind: 'Program',
      location: { end: { column: 1, line: 7 }, start: { column: 1, line: 1 } },
    });
  });

  test('checks examples/variables.p without semantic errors', async function testCheckerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./variables.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkVariablesProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).not.toThrow();
  });

  test('rejects null for a non-nullable type', function testNonNullableNullAssignment(): void {
    const sourceCode = 'var nickname: string = null;';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects an incompatible initializer type', function testIncompatibleInitializerType(): void {
    const sourceCode = 'val age: int = "Pulse";';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects byte literals outside the valid range', function testByteRangeValidation(): void {
    const sourceCode = 'var channel: byte = 300;';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidByteLiteral(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('accepts null for a nullable type', function testNullableNullAssignment(): void {
    const sourceCode = 'var nickname: string? = null;';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkNullableProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).not.toThrow();
  });

  test('generates C for examples/variables.p exactly as expected', async function testCGeneratorOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./variables.p', import.meta.url), 'utf8');
    const expectedCOutput: string = await readFile(new URL('./variables.c', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });

  test('rejects nullable types in the C generator for now', function testUnsupportedNullableCodegen(): void {
    const sourceCode = 'var nickname: string? = null;';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(function generateUnsupportedNullableProgram(): void {
      generator.generateProgram(program);
    }).toThrow(CGeneratorError);
  });

  test('derives the default native output path from the source file', function testDefaultBinaryOutputPath(): void {
    expect(getDefaultBinaryOutputPath('examples/variables.p')).toBe(`${process.cwd()}/examples/variables`);
  });

  test('derives the default C output path from the source file', function testDefaultCOutputPath(): void {
    expect(getDefaultCOutputPath('examples/variables.p')).toBe(`${process.cwd()}/examples/variables.c`);
  });
});
