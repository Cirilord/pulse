import { readFile } from 'node:fs/promises';

import { Lexer } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token-type.js';

describe('Lexer', function describeLexer(): void {
  test('tokenizes examples/variables.p exactly as expected', async function testVariablesFixture(): Promise<void> {
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
});
