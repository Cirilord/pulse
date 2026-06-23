import { readFile } from 'node:fs/promises';

import { getMainStatements, wrapInMain } from './test-helpers.js';
import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';
import { Parser } from '../src/parser/parser.js';

describe('inheritance example', function describeInheritanceExample(): void {
  test('tokenizes examples/inheritance.p with inheritance keywords', async function testLexerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./inheritance.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const tokens = lexer.tokenize().map(function toTokenShape(token): { lexeme: string; type: TokenType } {
      return {
        lexeme: token.lexeme,
        type: token.type,
      };
    });

    expect(tokens).toContainEqual({ lexeme: 'extends', type: TokenType.Extends });
    expect(tokens).toContainEqual({ lexeme: 'class', type: TokenType.Class });
    expect(tokens).toContainEqual({ lexeme: 'override', type: TokenType.Override });
    expect(tokens).toContainEqual({ lexeme: 'super', type: TokenType.Super });
  });

  test('parses examples/inheritance.p with a base class reference', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./inheritance.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const program = parser.parseProgram();

    expect(program.body[1]).toMatchObject({
      baseName: { name: 'Person' },
      kind: 'ClassDeclaration',
      members: expect.arrayContaining([
        expect.objectContaining({
          body: expect.objectContaining({
            body: expect.arrayContaining([
              expect.objectContaining({
                expression: expect.objectContaining({
                  callee: expect.objectContaining({ kind: 'SuperExpression' }),
                  kind: 'CallExpression',
                }),
                kind: 'ExpressionStatement',
              }),
            ]),
          }),
          isConstructor: true,
          kind: 'ClassMethodDeclaration',
          name: expect.objectContaining({ name: 'constructor' }),
        }),
        expect.objectContaining({
          isOverride: true,
          kind: 'ClassMethodDeclaration',
          name: expect.objectContaining({ name: 'getType' }),
        }),
      ]),
      name: { name: 'Admin' },
    });

    expect(getMainStatements(program)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'VariableDeclaration',
          name: expect.objectContaining({ name: 'adminName' }),
          type: expect.objectContaining({ kind: 'NamedType', name: 'string' }),
        }),
        expect.objectContaining({
          kind: 'VariableDeclaration',
          name: expect.objectContaining({ name: 'baseType' }),
          type: expect.objectContaining({ kind: 'NamedType', name: 'string' }),
        }),
        expect.objectContaining({
          kind: 'VariableDeclaration',
          name: expect.objectContaining({ name: 'baseName' }),
          type: expect.objectContaining({ kind: 'NamedType', name: 'string' }),
        }),
        expect.objectContaining({
          kind: 'VariableDeclaration',
          name: expect.objectContaining({ name: 'isPerson' }),
          type: expect.objectContaining({ kind: 'NamedType', name: 'boolean' }),
        }),
      ])
    );
  });

  test('checks examples/inheritance.p without semantic errors', async function testCheckerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./inheritance.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInheritanceProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).not.toThrow();
  });

  test('requires override for inherited methods', function testMissingOverride(): void {
    const sourceCode =
      `${wrapInMain('  return 0;')}\n\n` +
      'class Person {\n' +
      '  public fn getType(): string {\n' +
      '    return "person";\n' +
      '  }\n' +
      '}\n\n' +
      'class Admin extends Person {\n' +
      '  public fn getType(): string {\n' +
      '    return "admin";\n' +
      '  }\n' +
      '}';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkMissingOverrideProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects incompatible override signatures', function testInvalidOverrideSignature(): void {
    const sourceCode =
      `${wrapInMain('  return 0;')}\n\n` +
      'class Person {\n' +
      '  public fn getType(): string {\n' +
      '    return "person";\n' +
      '  }\n' +
      '}\n\n' +
      'class Admin extends Person {\n' +
      '  public override fn getType(): int {\n' +
      '    return 1;\n' +
      '  }\n' +
      '}';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidOverrideSignatureProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects super constructor calls outside constructors', function testInvalidSuperConstructorCall(): void {
    const sourceCode =
      `${wrapInMain('  return 0;')}\n\n` +
      'class Person {\n' +
      '  public fn constructor(val name: string) {\n' +
      '    this.name = name;\n' +
      '  }\n' +
      '  public val name: string;\n' +
      '}\n\n' +
      'class Admin extends Person {\n' +
      '  public fn constructor(val name: string) {\n' +
      '    super(name);\n' +
      '  }\n\n' +
      '  public fn invalid(): string {\n' +
      '    return super("Ana").name;\n' +
      '  }\n' +
      '}';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidSuperConstructorCallProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('requires super as the first statement in derived constructors', function testSuperOrder(): void {
    const sourceCode =
      `${wrapInMain('  return 0;')}\n\n` +
      'class Person {\n' +
      '  public val name: string;\n\n' +
      '  public fn constructor(val name: string) {\n' +
      '    this.name = name;\n' +
      '  }\n' +
      '}\n\n' +
      'class Admin extends Person {\n' +
      '  public val role: string;\n\n' +
      '  public fn constructor(val name: string, val role: string) {\n' +
      '    this.role = role;\n' +
      '    super(name);\n' +
      '  }\n' +
      '}';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkSuperOrderProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('requires exactly one super call in derived constructors', function testMultipleSuperCalls(): void {
    const sourceCode =
      `${wrapInMain('  return 0;')}\n\n` +
      'class Person {\n' +
      '  public val name: string;\n\n' +
      '  public fn constructor(val name: string) {\n' +
      '    this.name = name;\n' +
      '  }\n' +
      '}\n\n' +
      'class Admin extends Person {\n' +
      '  public fn constructor(val name: string) {\n' +
      '    super(name);\n' +
      '    super(name);\n' +
      '  }\n' +
      '}';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkMultipleSuperCallsProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('requires a super call when the base constructor exists', function testMissingSuperCall(): void {
    const sourceCode =
      `${wrapInMain('  return 0;')}\n\n` +
      'class Person {\n' +
      '  public val name: string;\n\n' +
      '  public fn constructor(val name: string) {\n' +
      '    this.name = name;\n' +
      '  }\n' +
      '}\n\n' +
      'class Admin extends Person {\n' +
      '  public fn constructor(val name: string) {\n' +
      '    return;\n' +
      '  }\n' +
      '}';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkMissingSuperCallProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('supports super across multiple inheritance levels', function testMultiLevelSuper(): void {
    const sourceCode =
      `${wrapInMain('  val admin: Admin = Admin("Root", "ops");\n  return isInstance(admin, Person) ? 1 : 0;')}\n\n` +
      'class Person {\n' +
      '  public val name: string;\n\n' +
      '  public fn constructor(val name: string) {\n' +
      '    this.name = name;\n' +
      '  }\n' +
      '}\n\n' +
      'class Employee extends Person {\n' +
      '  public fn constructor(val name: string) {\n' +
      '    super(name);\n' +
      '  }\n' +
      '}\n\n' +
      'class Admin extends Employee {\n' +
      '  public val role: string;\n\n' +
      '  public fn constructor(val name: string, val role: string) {\n' +
      '    super(name);\n' +
      '    this.role = role;\n' +
      '  }\n' +
      '}';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkMultiLevelSuperProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).not.toThrow();
  });

  test('rejects assigning a derived class value to a base class variable', function testSubtypeAssignmentBlocked(): void {
    const sourceCode =
      `${wrapInMain('  val person: Person = Admin("Root", "admin");\n  return 0;')}\n\n` +
      'class Person {\n' +
      '  public val name: string;\n\n' +
      '  public fn constructor(val name: string) {\n' +
      '    this.name = name;\n' +
      '  }\n' +
      '}\n\n' +
      'class Admin extends Person {\n' +
      '  public val role: string;\n\n' +
      '  public fn constructor(val name: string, val role: string) {\n' +
      '    super(name);\n' +
      '    this.role = role;\n' +
      '  }\n' +
      '}';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkSubtypeAssignmentBlockedProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('generates C for examples/inheritance.p exactly as expected', async function testCGeneratorOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./inheritance.p', import.meta.url), 'utf8');
    const expectedCOutput: string = await readFile(new URL('./inheritance.c', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });
});
