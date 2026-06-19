import { readFile } from 'node:fs/promises';

import { getMainStatements, wrapInMain } from './test-helpers.js';
import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';
import { Parser } from '../src/parser/parser.js';

describe('ifs example', function describeIfsExample(): void {
  test('tokenizes examples/ifs.p with if, elif, and else keywords', async function testLexerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./ifs.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const tokens = lexer.tokenize().map(function toTokenShape(token): { lexeme: string; type: TokenType } {
      return {
        lexeme: token.lexeme,
        type: token.type,
      };
    });

    expect(tokens).toContainEqual({ lexeme: 'if', type: TokenType.If });
    expect(tokens).toContainEqual({ lexeme: 'elif', type: TokenType.Elif });
    expect(tokens).toContainEqual({ lexeme: 'else', type: TokenType.Else });
  });

  test('parses examples/ifs.p with an if statement chain inside main', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./ifs.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());

    expect(getMainStatements(parser.parseProgram())[1]).toMatchObject({
      condition: {
        kind: 'BinaryExpression',
        operator: '==',
      },
      elseBranch: {
        condition: {
          kind: 'BinaryExpression',
          operator: '==',
        },
        elseBranch: {
          body: [{ kind: 'VariableDeclaration' }],
          kind: 'BlockStatement',
        },
        kind: 'IfStatement',
      },
      kind: 'IfStatement',
      thenBranch: {
        body: [{ kind: 'VariableDeclaration' }],
        kind: 'BlockStatement',
      },
    });
  });

  test('checks examples/ifs.p without semantic errors', async function testCheckerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./ifs.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkIfsProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).not.toThrow();
  });

  test('rejects if statements with non-boolean conditions', function testInvalidIfCondition(): void {
    const sourceCode = wrapInMain('  if (1) { val a: int = 1; }');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidIfConditionProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('generates C for examples/ifs.p exactly as expected', async function testCGeneratorOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./ifs.p', import.meta.url), 'utf8');
    const expectedCOutput: string = await readFile(new URL('./ifs.c', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });
});
