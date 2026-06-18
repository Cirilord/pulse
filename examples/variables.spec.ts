import { readFile } from 'node:fs/promises';

import { Checker, CheckerError } from '../src/checker/checker.js';
import { CGenerator, CGeneratorError } from '../src/codegen/c-generator.js';
import { getDefaultBinaryOutputPath, getDefaultCOutputPath } from '../src/compiler/c-compiler.js';
import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';
import { Parser } from '../src/parser/parser.js';

describe('variables example', function describeVariablesExample(): void {
  test('tokenizes examples/variables.p exactly as expected', async function testLexerOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./variables.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);

    expect(lexer.tokenize()).toStrictEqual([
      {
        lexeme: 'var',
        location: {
          end: {
            column: 4,
            line: 1,
          },
          start: {
            column: 1,
            line: 1,
          },
        },
        type: TokenType.Var,
      },
      {
        lexeme: 'a',
        location: {
          end: {
            column: 6,
            line: 1,
          },
          start: {
            column: 5,
            line: 1,
          },
        },
        type: TokenType.Identifier,
      },
      {
        lexeme: ':',
        location: {
          end: {
            column: 7,
            line: 1,
          },
          start: {
            column: 6,
            line: 1,
          },
        },
        type: TokenType.Colon,
      },
      {
        lexeme: 'int',
        location: {
          end: {
            column: 11,
            line: 1,
          },
          start: {
            column: 8,
            line: 1,
          },
        },
        type: TokenType.Identifier,
      },
      {
        lexeme: '=',
        location: {
          end: {
            column: 13,
            line: 1,
          },
          start: {
            column: 12,
            line: 1,
          },
        },
        type: TokenType.Equal,
      },
      {
        lexeme: '30',
        location: {
          end: {
            column: 16,
            line: 1,
          },
          start: {
            column: 14,
            line: 1,
          },
        },
        type: TokenType.IntegerLiteral,
      },
      {
        lexeme: ';',
        location: {
          end: {
            column: 17,
            line: 1,
          },
          start: {
            column: 16,
            line: 1,
          },
        },
        type: TokenType.Semicolon,
      },
      {
        lexeme: 'val',
        location: {
          end: {
            column: 4,
            line: 2,
          },
          start: {
            column: 1,
            line: 2,
          },
        },
        type: TokenType.Val,
      },
      {
        lexeme: 'b',
        location: {
          end: {
            column: 6,
            line: 2,
          },
          start: {
            column: 5,
            line: 2,
          },
        },
        type: TokenType.Identifier,
      },
      {
        lexeme: ':',
        location: {
          end: {
            column: 7,
            line: 2,
          },
          start: {
            column: 6,
            line: 2,
          },
        },
        type: TokenType.Colon,
      },
      {
        lexeme: 'string',
        location: {
          end: {
            column: 14,
            line: 2,
          },
          start: {
            column: 8,
            line: 2,
          },
        },
        type: TokenType.Identifier,
      },
      {
        lexeme: '=',
        location: {
          end: {
            column: 16,
            line: 2,
          },
          start: {
            column: 15,
            line: 2,
          },
        },
        type: TokenType.Equal,
      },
      {
        lexeme: '"Test"',
        location: {
          end: {
            column: 23,
            line: 2,
          },
          start: {
            column: 17,
            line: 2,
          },
        },
        type: TokenType.StringLiteral,
      },
      {
        lexeme: ';',
        location: {
          end: {
            column: 24,
            line: 2,
          },
          start: {
            column: 23,
            line: 2,
          },
        },
        type: TokenType.Semicolon,
      },
      {
        lexeme: '',
        location: {
          end: {
            column: 1,
            line: 3,
          },
          start: {
            column: 1,
            line: 3,
          },
        },
        type: TokenType.EOF,
      },
    ]);
  });

  test('parses examples/variables.p exactly as expected', async function testParserOutput(): Promise<void> {
    const sourceCode: string = await readFile(new URL('./variables.p', import.meta.url), 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());

    expect(parser.parseProgram()).toStrictEqual({
      body: [
        {
          initializer: {
            kind: 'IntegerLiteral',
            location: {
              end: {
                column: 16,
                line: 1,
              },
              start: {
                column: 14,
                line: 1,
              },
            },
            value: 30,
          },
          kind: 'VariableDeclaration',
          location: {
            end: {
              column: 17,
              line: 1,
            },
            start: {
              column: 1,
              line: 1,
            },
          },
          mutability: 'var',
          name: {
            kind: 'Identifier',
            location: {
              end: {
                column: 6,
                line: 1,
              },
              start: {
                column: 5,
                line: 1,
              },
            },
            name: 'a',
          },
          type: {
            kind: 'NamedType',
            location: {
              end: {
                column: 11,
                line: 1,
              },
              start: {
                column: 8,
                line: 1,
              },
            },
            name: 'int',
          },
        },
        {
          initializer: {
            kind: 'StringLiteral',
            location: {
              end: {
                column: 23,
                line: 2,
              },
              start: {
                column: 17,
                line: 2,
              },
            },
            value: 'Test',
          },
          kind: 'VariableDeclaration',
          location: {
            end: {
              column: 24,
              line: 2,
            },
            start: {
              column: 1,
              line: 2,
            },
          },
          mutability: 'val',
          name: {
            kind: 'Identifier',
            location: {
              end: {
                column: 6,
                line: 2,
              },
              start: {
                column: 5,
                line: 2,
              },
            },
            name: 'b',
          },
          type: {
            kind: 'NamedType',
            location: {
              end: {
                column: 14,
                line: 2,
              },
              start: {
                column: 8,
                line: 2,
              },
            },
            name: 'string',
          },
        },
      ],
      kind: 'Program',
      location: {
        end: {
          column: 1,
          line: 3,
        },
        start: {
          column: 1,
          line: 1,
        },
      },
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
    const sourceCode = 'var nickname: string = null;';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('rejects an incompatible initializer type', function testIncompatibleInitializerType(): void {
    const sourceCode = 'val age: int = "Pulse";';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();

    expect(function checkInvalidProgram(): void {
      checker.checkProgram(parser.parseProgram());
    }).toThrow(CheckerError);
  });

  test('accepts null for a nullable type', function testNullableNullAssignment(): void {
    const sourceCode = 'var nickname: string? = null;';
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

  test('derives the default native output path from the source file', function testDefaultBinaryOutputPath(): void {
    expect(getDefaultBinaryOutputPath('examples/variables.p')).toBe(`${process.cwd()}/examples/variables`);
  });

  test('derives the default C output path from the source file', function testDefaultCOutputPath(): void {
    expect(getDefaultCOutputPath('examples/variables.p')).toBe(`${process.cwd()}/examples/variables.c`);
  });

  test('rejects nullable types in the C generator for now', function testUnsupportedNullableCodegen(): void {
    const sourceCode = 'var nickname: string? = null;';
    const lexer: Lexer = new Lexer(sourceCode);
    const parser: Parser = new Parser(lexer.tokenize());
    const checker: Checker = new Checker();
    const generator: CGenerator = new CGenerator();
    const program = parser.parseProgram();

    checker.checkProgram(program);

    expect(function generateUnsupportedNullableProgram(): void {
      generator.generateProgram(program);
    }).toThrow(CGeneratorError);
  });
});
