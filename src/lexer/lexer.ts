import { KEYWORDS } from './keywords.js';
import { TokenType } from './token-type.js';
import type { Token, TokenLocation } from './token.js';

export class LexerError extends Error {
  public readonly location: TokenLocation;

  public constructor(message: string, location: TokenLocation) {
    super(message);
    this.location = location;
    this.name = 'LexerError';
  }
}

export class Lexer {
  private column: number;

  private index: number;

  private line: number;

  private readonly source: string;

  public constructor(source: string) {
    this.column = 1;
    this.index = 0;
    this.line = 1;
    this.source = source;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (!this.isAtEnd()) {
      this.skipIgnoredCharacters();

      if (this.isAtEnd()) {
        break;
      }

      const character: string | undefined = this.peek();
      const startColumn: number = this.column;
      const startIndex: number = this.index;
      const startLine: number = this.line;

      if (this.isIdentifierStart(character)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      if (this.isDigit(character)) {
        tokens.push(this.readNumber());
        continue;
      }

      if (character === '"') {
        tokens.push(this.readString());
        continue;
      }

      this.advance();

      switch (character) {
        case ':':
          tokens.push(this.createToken(TokenType.Colon, startIndex, startLine, startColumn));
          break;
        case ',':
          tokens.push(this.createToken(TokenType.Comma, startIndex, startLine, startColumn));
          break;
        case '=':
          tokens.push(this.createToken(TokenType.Equal, startIndex, startLine, startColumn));
          break;
        case '?':
          tokens.push(this.createToken(TokenType.QuestionMark, startIndex, startLine, startColumn));
          break;
        case ';':
          tokens.push(this.createToken(TokenType.Semicolon, startIndex, startLine, startColumn));
          break;
        case '(':
          tokens.push(this.createToken(TokenType.LeftParen, startIndex, startLine, startColumn));
          break;
        case ')':
          tokens.push(this.createToken(TokenType.RightParen, startIndex, startLine, startColumn));
          break;
        case '{':
          tokens.push(this.createToken(TokenType.LeftBrace, startIndex, startLine, startColumn));
          break;
        case '}':
          tokens.push(this.createToken(TokenType.RightBrace, startIndex, startLine, startColumn));
          break;
        default:
          throw new LexerError(
            `Unexpected character '${character ?? 'EOF'}'.`,
            this.createLocation(startLine, startColumn)
          );
      }
    }

    tokens.push({
      lexeme: '',
      location: {
        end: {
          column: this.column,
          line: this.line,
        },
        start: {
          column: this.column,
          line: this.line,
        },
      },
      type: TokenType.EOF,
    });

    return tokens;
  }

  private advance(): string {
    const character: string | undefined = this.source[this.index];

    if (character === undefined) {
      throw new Error('Cannot advance beyond the end of the source.');
    }

    this.index += 1;

    if (character === '\n') {
      this.line += 1;
      this.column = 1;
      return character;
    }

    this.column += 1;
    return character;
  }

  private createLocation(startLine: number, startColumn: number): TokenLocation {
    return {
      start: {
        line: startLine,
        column: startColumn,
      },
      end: {
        line: this.line,
        column: this.column,
      },
    };
  }

  private createToken(type: TokenType, startIndex: number, startLine: number, startColumn: number): Token {
    return {
      type,
      lexeme: this.source.slice(startIndex, this.index),
      location: this.createLocation(startLine, startColumn),
    };
  }

  private isAtEnd(): boolean {
    return this.index >= this.source.length;
  }

  private isDigit(character: string | undefined): boolean {
    return character !== undefined && character >= '0' && character <= '9';
  }

  private isIdentifierPart(character: string | undefined): boolean {
    return this.isIdentifierStart(character) || this.isDigit(character);
  }

  private isIdentifierStart(character: string | undefined): boolean {
    return character !== undefined && /[A-Za-z_]/u.test(character);
  }

  private peek(): string | undefined {
    return this.source[this.index];
  }

  private peekNext(): string | undefined {
    return this.source[this.index + 1];
  }

  private readIdentifier(): Token {
    const startColumn: number = this.column;
    const startIndex: number = this.index;
    const startLine: number = this.line;

    while (this.isIdentifierPart(this.peek())) {
      this.advance();
    }

    const lexeme: string = this.source.slice(startIndex, this.index);
    const type: TokenType = KEYWORDS.get(lexeme) ?? TokenType.Identifier;

    return this.createToken(type, startIndex, startLine, startColumn);
  }

  private readNumber(): Token {
    const startColumn: number = this.column;
    const startIndex: number = this.index;
    const startLine: number = this.line;

    while (this.isDigit(this.peek())) {
      this.advance();
    }

    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance();

      while (this.isDigit(this.peek())) {
        this.advance();
      }

      return this.createToken(TokenType.DoubleLiteral, startIndex, startLine, startColumn);
    }

    return this.createToken(TokenType.IntegerLiteral, startIndex, startLine, startColumn);
  }

  private readString(): Token {
    const startColumn: number = this.column;
    const startIndex: number = this.index;
    const startLine: number = this.line;

    this.advance();

    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\n') {
        throw new LexerError('Unterminated string literal.', this.createLocation(startLine, startColumn));
      }

      this.advance();
    }

    if (this.isAtEnd()) {
      throw new LexerError('Unterminated string literal.', this.createLocation(startLine, startColumn));
    }

    this.advance();

    return this.createToken(TokenType.StringLiteral, startIndex, startLine, startColumn);
  }

  private skipIgnoredCharacters(): void {
    while (!this.isAtEnd()) {
      const character: string | undefined = this.peek();

      if (character === ' ' || character === '\r' || character === '\t' || character === '\n') {
        this.advance();
        continue;
      }

      if (character === '/' && this.peekNext() === '/') {
        while (!this.isAtEnd() && this.peek() !== '\n') {
          this.advance();
        }

        continue;
      }

      return;
    }
  }
}
