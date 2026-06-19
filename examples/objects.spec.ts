import { readFile } from 'node:fs/promises';

import { getMainStatements, wrapInMain } from './test-helpers.js';
import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';
import { Parser } from '../src/parser/parser.js';

describe('objects example', function describeObjectsExample(): void {
  test('tokenizes examples/objects.p with class-related keywords', async function testLexerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./objects.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const tokens = lexer.tokenize().map(function toTokenShape(token): { lexeme: string; type: TokenType } {
      return {
        lexeme: token.lexeme,
        type: token.type,
      };
    });

    expect(tokens).toContainEqual({ lexeme: 'class', type: TokenType.Class });
    expect(tokens).toContainEqual({ lexeme: 'public', type: TokenType.Public });
    expect(tokens).toContainEqual({ lexeme: 'private', type: TokenType.Private });
    expect(tokens).toContainEqual({ lexeme: 'static', type: TokenType.Static });
    expect(tokens).toContainEqual({ lexeme: 'this', type: TokenType.This });
  });

  test('parses examples/objects.p with class members and method calls', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./objects.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const program = parser.parseProgram();

    expect(program.body[0]).toMatchObject({
      kind: 'ClassDeclaration',
      name: { name: 'User' },
    });

    expect((program.body[0] as { members: unknown[] }).members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          access: 'public',
          kind: 'ClassFieldDeclaration',
          mutability: 'val',
          name: expect.objectContaining({ name: 'name' }),
        }),
        expect.objectContaining({
          access: 'private',
          kind: 'ClassFieldDeclaration',
          mutability: 'var',
          name: expect.objectContaining({ name: 'age' }),
        }),
        expect.objectContaining({
          access: 'public',
          isConstructor: true,
          isStatic: false,
          kind: 'ClassMethodDeclaration',
          name: expect.objectContaining({ name: 'constructor' }),
        }),
      ])
    );

    expect(getMainStatements(program)[0]).toMatchObject({
      initializer: {
        arguments: [{ value: 'Ana' }, { value: 20 }],
        kind: 'CallExpression',
      },
      kind: 'VariableDeclaration',
      name: { name: 'user' },
      type: { kind: 'NamedType', name: 'User' },
    });
  });

  test('checks examples/objects.p without semantic errors', async function testCheckerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./objects.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkObjectsProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).not.toThrow();
  });

  test('rejects this inside static methods', function testStaticThisUsage(): void {
    const sourceCode = `${wrapInMain('  return 0;')}\n\nclass User {\n  public val name: string;\n\n  public fn constructor(val name: string) {\n    this.name = name;\n  }\n\n  public static fn invalid(): int {\n    return this.name;\n  }\n}`;
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkStaticThisUsageProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects mutating method calls on immutable objects', function testImmutableMutatingMethodCall(): void {
    const sourceCode = `${wrapInMain('  val user: User = User("Ana", 20); user.birthday();\n  return 0;')}\n\nclass User {\n  public val name: string;\n  private var age: int;\n\n  public fn constructor(val name: string, val age: int) {\n    this.name = name;\n    this.age = age;\n  }\n\n  public fn birthday(): void {\n    this.age += 1;\n    return;\n  }\n}`;
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkImmutableMutatingMethodCallProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('generates C for examples/objects.p exactly as expected', async function testCGeneratorOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./objects.p', import.meta.url), 'utf8');
    const expectedCOutput: string = await readFile(new URL('./objects.c', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });
});
