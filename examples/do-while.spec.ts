import { readFile } from 'node:fs/promises';

import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';
import { Parser } from '../src/parser/parser.js';

describe('do-while example', function describeDoWhileExample(): void {
  test('tokenizes examples/do-while.p with the do keyword', async function testLexerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./do-while.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const tokens = lexer.tokenize().map(function toTokenShape(token): { lexeme: string; type: TokenType } {
      return {
        lexeme: token.lexeme,
        type: token.type,
      };
    });

    expect(tokens).toContainEqual({ lexeme: 'do', type: TokenType.Do });
    expect(tokens).toContainEqual({ lexeme: 'while', type: TokenType.While });
  });

  test('parses examples/do-while.p with a do-while statement', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./do-while.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const program = parser.parseProgram();

    expect(program.body[1]).toMatchObject({
      body: {
        body: [{ kind: 'ExpressionStatement' }],
        kind: 'BlockStatement',
      },
      condition: {
        kind: 'BinaryExpression',
        operator: '<',
      },
      kind: 'DoWhileStatement',
    });
  });

  test('checks examples/do-while.p without semantic errors', async function testCheckerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./do-while.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkDoWhileProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).not.toThrow();
  });

  test('rejects do-while statements with non-boolean conditions', function testInvalidDoWhileCondition(): void {
    const sourceCode = 'do { val a: int = 1; } while (1);';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidDoWhileConditionProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('generates C for examples/do-while.p exactly as expected', async function testCGeneratorOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./do-while.p', import.meta.url), 'utf8');
    const expectedCOutput: string = await readFile(new URL('./do-while.c', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });
});
