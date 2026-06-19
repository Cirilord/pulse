import { readFile } from 'node:fs/promises';

import { getMainStatements, wrapInMain } from './test-helpers.js';
import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';
import { Parser } from '../src/parser/parser.js';

describe('for example', function describeForExample(): void {
  test('tokenizes examples/for.p with the for keyword', async function testLexerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./for.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const tokens = lexer.tokenize().map(function toTokenShape(token): { lexeme: string; type: TokenType } {
      return {
        lexeme: token.lexeme,
        type: token.type,
      };
    });

    expect(tokens).toContainEqual({ lexeme: 'for', type: TokenType.For });
  });

  test('parses examples/for.p with a for statement inside main', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./for.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());

    expect(getMainStatements(parser.parseProgram())[0]).toMatchObject({
      body: {
        body: [{ kind: 'VariableDeclaration' }],
        kind: 'BlockStatement',
      },
      condition: {
        kind: 'BinaryExpression',
        operator: '<',
      },
      initializer: {
        kind: 'VariableDeclaration',
        name: { name: 'index' },
      },
      kind: 'ForStatement',
      update: {
        kind: 'AssignmentExpression',
        operator: '+=',
      },
    });
  });

  test('checks examples/for.p without semantic errors', async function testCheckerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./for.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkForProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).not.toThrow();
  });

  test('rejects for statements with non-boolean conditions', function testInvalidForCondition(): void {
    const sourceCode = wrapInMain('  for (var index: int = 0; 1; index += 1) { var copy: int = index; }');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidForConditionProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('generates C for examples/for.p exactly as expected', async function testCGeneratorOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./for.p', import.meta.url), 'utf8');
    const expectedCOutput: string = await readFile(new URL('./for.c', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });
});
