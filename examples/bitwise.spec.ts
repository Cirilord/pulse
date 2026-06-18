import { readFile } from 'node:fs/promises';

import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';
import { Parser } from '../src/parser/parser.js';

describe('bitwise example', function describeBitwiseExample(): void {
  test('tokenizes examples/bitwise.p with bitwise operators', async function testLexerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./bitwise.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const tokens = lexer.tokenize().map(function toTokenShape(token): { lexeme: string; type: TokenType } {
      return {
        lexeme: token.lexeme,
        type: token.type,
      };
    });

    expect(tokens).toContainEqual({ lexeme: '&', type: TokenType.Ampersand });
    expect(tokens).toContainEqual({ lexeme: '|', type: TokenType.Pipe });
    expect(tokens).toContainEqual({ lexeme: '^', type: TokenType.Caret });
    expect(tokens).toContainEqual({ lexeme: '<<', type: TokenType.LeftShift });
    expect(tokens).toContainEqual({ lexeme: '>>', type: TokenType.RightShift });
    expect(tokens).toContainEqual({ lexeme: '~', type: TokenType.Tilde });
    expect(tokens).toContainEqual({ lexeme: '&=', type: TokenType.AmpersandEqual });
    expect(tokens).toContainEqual({ lexeme: '|=', type: TokenType.PipeEqual });
    expect(tokens).toContainEqual({ lexeme: '^=', type: TokenType.CaretEqual });
    expect(tokens).toContainEqual({ lexeme: '<<=', type: TokenType.LeftShiftEqual });
    expect(tokens).toContainEqual({ lexeme: '>>=', type: TokenType.RightShiftEqual });
  });

  test('parses bitwise expressions and assignments', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./bitwise.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const program = parser.parseProgram();

    expect(program.body[0]).toMatchObject({
      initializer: {
        kind: 'BinaryExpression',
        operator: '&',
      },
    });

    expect(program.body[5]).toMatchObject({
      initializer: {
        kind: 'UnaryExpression',
        operator: '~',
      },
    });

    expect(program.body[7]).toMatchObject({
      expression: {
        kind: 'AssignmentExpression',
        operator: '&=',
      },
    });
  });

  test('checks examples/bitwise.p without semantic errors', async function testCheckerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./bitwise.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkBitwiseProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).not.toThrow();
  });

  test('rejects bitwise operators on non-integer values', function testInvalidBitwiseOperands(): void {
    const sourceCode = 'val invalid: boolean = true & false;';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidBitwiseProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects unary bitwise not on floating-point values', function testInvalidBitwiseUnaryOperand(): void {
    const sourceCode = 'val invalid: double = ~1.5;';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidBitwiseUnaryProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('generates C for examples/bitwise.p exactly as expected', async function testCGeneratorOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./bitwise.p', import.meta.url), 'utf8');
    const expectedCOutput: string = await readFile(new URL('./bitwise.c', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(generator.generateProgram(program)).toBe(expectedCOutput);
  });
});
