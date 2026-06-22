import { readFile } from 'node:fs/promises';

import { getMainStatements, wrapInMain } from './test-helpers.js';
import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { Parser } from '../src/parser/parser.js';

describe('errors example', function describeErrorsExample(): void {
  test('parses examples/errors.p with throws and explicit error bindings', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./errors.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const program = parser.parseProgram();

    expect(program.body[0]).toMatchObject({
      kind: 'ClassDeclaration',
      name: { name: 'ParseError' },
    });

    expect(program.body[2]).toMatchObject({
      kind: 'FunctionDeclaration',
      name: { name: 'parse' },
      returnType: { kind: 'NullableType', type: { name: 'int' } },
      throws: [
        { kind: 'NamedType', name: 'ParseError' },
        { kind: 'NamedType', name: 'IoError' },
      ],
    });

    expect(getMainStatements(program)[0]).toMatchObject({
      bindings: [
        { name: { name: 'value' }, type: { kind: 'NullableType', type: { name: 'int' } } },
        { name: { name: 'err' }, type: { kind: 'NullableType', type: { name: 'unknown' } } },
      ],
      initializer: { kind: 'CallExpression' },
      kind: 'MultiVariableDeclaration',
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

  test('allows accessing refined unknown error fields after isInstance', function testUnknownErrorNarrowing(): void {
    const sourceCode =
      'class ParseError {\n' +
      '  public val message: string;\n\n' +
      '  public fn constructor(val message: string) {\n' +
      '    this.message = message;\n' +
      '  }\n' +
      '}\n\n' +
      'class IoError {\n' +
      '  public val message: string;\n\n' +
      '  public fn constructor(val message: string) {\n' +
      '    this.message = message;\n' +
      '  }\n' +
      '}\n\n' +
      'fn parse(val text: string): int? throws ParseError, IoError {\n' +
      '  return null, ParseError("Empty text");\n' +
      '}\n\n' +
      wrapInMain(
        '  val value: int?, val err: unknown? = parse("");\n' +
          '  if (err != null && isInstance(err, ParseError)) {\n' +
          '    return err.message == "" ? 1 : 0;\n' +
          '  }\n' +
          '  return value ?? 0;'
      );
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkUnknownErrorNarrowingProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).not.toThrow();
  });

  test('rejects accessing unknown error fields without isInstance narrowing', function testUnknownErrorWithoutNarrowing(): void {
    const sourceCode =
      'class ParseError {\n' +
      '  public val message: string;\n\n' +
      '  public fn constructor(val message: string) {\n' +
      '    this.message = message;\n' +
      '  }\n' +
      '}\n\n' +
      'class IoError {\n' +
      '  public val message: string;\n\n' +
      '  public fn constructor(val message: string) {\n' +
      '    this.message = message;\n' +
      '  }\n' +
      '}\n\n' +
      'fn parse(val text: string): int? throws ParseError, IoError {\n' +
      '  return null, ParseError("Empty text");\n' +
      '}\n\n' +
      wrapInMain('  val value: int?, val err: unknown? = parse("");\n  return err.message == "" ? 1 : 0;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkUnknownErrorWithoutNarrowingProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
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

  test('rejects capturing multiple thrown types without unknown?', function testInvalidMultiThrowBinding(): void {
    const sourceCode =
      'class ParseError {\n' +
      '  public val message: string;\n\n' +
      '  public fn constructor(val message: string) {\n' +
      '    this.message = message;\n' +
      '  }\n' +
      '}\n\n' +
      'class IoError {\n' +
      '  public val message: string;\n\n' +
      '  public fn constructor(val message: string) {\n' +
      '    this.message = message;\n' +
      '  }\n' +
      '}\n\n' +
      'fn parse(val text: string): int? throws ParseError, IoError {\n' +
      '  return null, ParseError("Empty text");\n' +
      '}\n\n' +
      wrapInMain('  val value: int?, val err: ParseError? = parse("");\n  return 0;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidMultiThrowBindingProgram(): void {
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
