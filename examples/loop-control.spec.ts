import { readFile } from 'node:fs/promises';

import { getMainStatements, wrapInMain } from './test-helpers.js';
import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';
import { Parser } from '../src/parser/parser.js';

describe('loop-control example', function describeLoopControlExample(): void {
  test('tokenizes examples/loop-control.p with break and continue keywords', async function testLexerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./loop-control.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const tokens = lexer.tokenize().map(function toTokenShape(token): { lexeme: string; type: TokenType } {
      return {
        lexeme: token.lexeme,
        type: token.type,
      };
    });

    expect(tokens).toContainEqual({ lexeme: 'break', type: TokenType.Break });
    expect(tokens).toContainEqual({ lexeme: 'continue', type: TokenType.Continue });
  });

  test('parses examples/loop-control.p with break and continue statements inside main', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./loop-control.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const statements = getMainStatements(parser.parseProgram());

    expect(statements[1]).toMatchObject({
      body: {
        body: [
          { kind: 'ExpressionStatement' },
          {
            kind: 'IfStatement',
            thenBranch: {
              body: [{ kind: 'ContinueStatement' }],
            },
          },
          {
            kind: 'IfStatement',
            thenBranch: {
              body: [{ kind: 'BreakStatement' }],
            },
          },
        ],
      },
      kind: 'WhileStatement',
    });

    expect(statements[3]).toMatchObject({
      body: {
        body: [
          { kind: 'ExpressionStatement' },
          {
            kind: 'IfStatement',
            thenBranch: {
              body: [{ kind: 'BreakStatement' }],
            },
          },
        ],
      },
      kind: 'DoWhileStatement',
    });
  });

  test('checks examples/loop-control.p without semantic errors', async function testCheckerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./loop-control.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkLoopControlProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).not.toThrow();
  });

  test('rejects break statements outside loops', function testInvalidBreakStatement(): void {
    const sourceCode = wrapInMain('  break;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidBreakProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects continue statements outside loops', function testInvalidContinueStatement(): void {
    const sourceCode = wrapInMain('  continue;');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidContinueProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('generates C for examples/loop-control.p exactly as expected', async function testCGeneratorOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./loop-control.p', import.meta.url), 'utf8');
    const expectedCOutput: string = await readFile(new URL('./loop-control.c', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });
});
