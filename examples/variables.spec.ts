import { readFile } from 'node:fs/promises';

import { getMainFunction, getMainStatements, wrapInMain } from './test-helpers.js';
import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { getDefaultBinaryOutputPath, getDefaultCOutputPath } from '../src/compiler/c-compiler.js';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';
import { Parser } from '../src/parser/parser.js';

describe('variables example', function describeVariablesExample(): void {
  test('tokenizes examples/variables.p with primitive and nullable declarations', async function testLexerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./variables.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const tokens = lexer.tokenize();

    expect(tokens[0]).toMatchObject({ lexeme: 'fn', type: TokenType.Fn });
    expect(tokens[1]).toMatchObject({ lexeme: 'main', type: TokenType.Identifier });
    expect(tokens).toContainEqual(expect.objectContaining({ lexeme: 'string', type: TokenType.Identifier }));
    expect(tokens).toContainEqual(expect.objectContaining({ lexeme: 'float', type: TokenType.Identifier }));
    expect(tokens).toContainEqual(expect.objectContaining({ lexeme: '?', type: TokenType.QuestionMark }));
    expect(tokens).toContainEqual(expect.objectContaining({ lexeme: 'null', type: TokenType.Null }));
    expect(tokens.at(-1)).toMatchObject({ lexeme: '', type: TokenType.EOF });
  });

  test('parses examples/variables.p with declarations inside main', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./variables.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const program = parser.parseProgram();
    const statements = getMainStatements(program);

    expect(getMainFunction(program)).toMatchObject({
      kind: 'FunctionDeclaration',
      name: { name: 'main' },
      returnType: { kind: 'NamedType', name: 'int' },
    });

    expect(statements[0]).toMatchObject({
      kind: 'VariableDeclaration',
      mutability: 'var',
      name: { name: 'a' },
      type: { kind: 'NamedType', name: 'int' },
      initializer: { kind: 'IntegerLiteral', value: 30 },
    });

    expect(statements[1]).toMatchObject({
      kind: 'VariableDeclaration',
      mutability: 'val',
      name: { name: 'b' },
      type: { kind: 'NamedType', name: 'string' },
      initializer: { kind: 'StringLiteral', value: 'Test' },
    });

    expect(statements[7]).toMatchObject({
      kind: 'VariableDeclaration',
      name: { name: 'nickname' },
      type: { kind: 'NullableType', type: { kind: 'NamedType', name: 'string' } },
      initializer: { kind: 'NullLiteral' },
    });

    expect(statements[8]).toMatchObject({
      kind: 'VariableDeclaration',
      name: { name: 'score' },
      type: { kind: 'NullableType', type: { kind: 'NamedType', name: 'int' } },
      initializer: { kind: 'NullLiteral' },
    });

    expect(statements[9]).toMatchObject({
      kind: 'VariableDeclaration',
      name: { name: 'ratio' },
      type: { kind: 'NullableType', type: { kind: 'NamedType', name: 'float' } },
      initializer: { kind: 'NullLiteral' },
    });

    expect(statements[10]).toMatchObject({
      kind: 'ReturnStatement',
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
    const sourceCode = wrapInMain('  var nickname: string = null;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects an incompatible initializer type', function testIncompatibleInitializerType(): void {
    const sourceCode = wrapInMain('  val age: int = "Pulse";');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects byte literals outside the valid range', function testByteRangeValidation(): void {
    const sourceCode = wrapInMain('  var channel: byte = 300;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidByteLiteral(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects void as a variable type', function testVoidVariableType(): void {
    const sourceCode = wrapInMain('  val nothing: void = null;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkVoidVariableDeclaration(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects char values with more than one character', function testInvalidCharLength(): void {
    const sourceCode = wrapInMain('  val initial: char = "AB";');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidCharValue(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('accepts null for a nullable type', function testNullableNullAssignment(): void {
    const sourceCode = wrapInMain('  var nickname: string? = null;');
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

  test('generates C for a nullable string declaration inside main', function testNullableCodegen(): void {
    const sourceCode = wrapInMain('  var nickname: string? = null;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(
      [
        '#include <stdbool.h>',
        '#include <stddef.h>',
        '',
        'typedef struct {',
        '  size_t length;',
        '  const char *data;',
        '} string_t;',
        '',
        '#define STRING_LITERAL(value) ((string_t){ sizeof(value) - 1, value })',
        '',
        'typedef struct {',
        '  bool is_null;',
        '  string_t value;',
        '} string_t_nullable;',
        '',
        'int main(void);',
        '',
        'int main(void) {',
        '  string_t_nullable nickname = (string_t_nullable){ .is_null = true, .value = (string_t){ .length = 0, .data = NULL } };',
        '  return 0;',
        '}',
        '',
      ].join('\n') + '\n'
    );
  });

  test('rejects top-level executable statements outside functions', function testTopLevelStatements(): void {
    const sourceCode = 'val nickname: string = "Pulse";';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkTopLevelStatementsProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('derives the default native output path from the source file', function testDefaultBinaryOutputPath(): void {
    expect(getDefaultBinaryOutputPath('examples/variables.p')).toBe(`${process.cwd()}/examples/variables`);
  });

  test('derives the default C output path from the source file', function testDefaultCOutputPath(): void {
    expect(getDefaultCOutputPath('examples/variables.p')).toBe(`${process.cwd()}/examples/variables.c`);
  });
});
