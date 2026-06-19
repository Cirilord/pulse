import { readFile } from 'node:fs/promises';

import { getMainStatements } from './test-helpers.js';
import { Checker } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';
import { Parser } from '../src/parser/parser.js';

describe('grouping example', function describeGroupingExample(): void {
  test('tokenizes examples/grouping.p with parentheses', async function testLexerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./grouping.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const tokens = lexer.tokenize().map(function toTokenShape(token): { lexeme: string; type: TokenType } {
      return {
        lexeme: token.lexeme,
        type: token.type,
      };
    });

    expect(tokens).toContainEqual({ lexeme: '(', type: TokenType.LeftParen });
    expect(tokens).toContainEqual({ lexeme: ')', type: TokenType.RightParen });
  });

  test('parses grouping expressions explicitly inside main', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./grouping.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const statements = getMainStatements(parser.parseProgram());

    expect(statements[0]).toMatchObject({
      initializer: {
        kind: 'BinaryExpression',
        left: {
          kind: 'GroupingExpression',
        },
        operator: '*',
      },
    });

    expect(statements[1]).toMatchObject({
      initializer: {
        kind: 'UnaryExpression',
        operator: '!',
        expression: {
          kind: 'GroupingExpression',
        },
      },
    });
  });

  test('checks and generates examples/grouping.p exactly as expected', async function testCodegenOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./grouping.p', import.meta.url), 'utf8');
    const expectedCOutput: string = await readFile(new URL('./grouping.c', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });
});
