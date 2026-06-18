import { TokenType } from '../lexer/token-type.js';
import type { Token, TokenLocation } from '../lexer/token.js';
import type {
  ExpressionNode,
  IdentifierNode,
  NamedTypeNode,
  NullableTypeNode,
  ProgramNode,
  StatementNode,
  TypeNode,
  VariableDeclarationNode,
} from './ast/index.js';

export class ParserError extends Error {
  public readonly location: TokenLocation;

  public constructor(message: string, location: TokenLocation) {
    super(message);
    this.location = location;
    this.name = 'ParserError';
  }
}

export class Parser {
  private index: number;

  private readonly tokens: Token[];

  public constructor(tokens: Token[]) {
    this.index = 0;
    this.tokens = tokens;
  }

  public parseProgram(): ProgramNode {
    const statements: StatementNode[] = [];
    const startToken: Token = this.peek();

    while (!this.isAtEnd()) {
      statements.push(this.parseStatement());
    }

    const endToken: Token = this.peek();

    return {
      body: statements,
      kind: 'Program',
      location: this.mergeLocations(startToken.location, endToken.location),
    };
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.index += 1;
    }

    return this.previous();
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) {
      return false;
    }

    return this.peek().type === type;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }

    throw new ParserError(message, this.peek().location);
  }

  private createIdentifierNode(token: Token): IdentifierNode {
    return {
      kind: 'Identifier',
      location: token.location,
      name: token.lexeme,
    };
  }

  private createNamedTypeNode(token: Token): NamedTypeNode {
    return {
      kind: 'NamedType',
      location: token.location,
      name: token.lexeme,
    };
  }

  private createUnexpectedTokenError(): never {
    throw new Error('Parser requires at least one token.');
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }

    return false;
  }

  private mergeLocations(start: TokenLocation, end: TokenLocation): TokenLocation {
    return {
      end: end.end,
      start: start.start,
    };
  }

  private parseExpression(): ExpressionNode {
    if (this.match(TokenType.IntegerLiteral)) {
      const token: Token = this.previous();

      return {
        kind: 'IntegerLiteral',
        location: token.location,
        value: Number(token.lexeme),
      };
    }

    if (this.match(TokenType.StringLiteral)) {
      const token: Token = this.previous();

      return {
        kind: 'StringLiteral',
        location: token.location,
        value: token.lexeme.slice(1, -1),
      };
    }

    if (this.match(TokenType.Null)) {
      const token: Token = this.previous();

      return {
        kind: 'NullLiteral',
        location: token.location,
      };
    }

    throw new ParserError('Expected an expression.', this.peek().location);
  }

  private parseStatement(): StatementNode {
    if (this.match(TokenType.Var, TokenType.Val)) {
      return this.parseVariableDeclaration(this.previous());
    }

    throw new ParserError('Expected a statement.', this.peek().location);
  }

  private parseType(): TypeNode {
    const nameToken: Token = this.consume(TokenType.Identifier, 'Expected a type name.');
    const namedType: NamedTypeNode = this.createNamedTypeNode(nameToken);

    if (!this.match(TokenType.QuestionMark)) {
      return namedType;
    }

    const nullableToken: Token = this.previous();
    const nullableType: NullableTypeNode = {
      kind: 'NullableType',
      location: this.mergeLocations(namedType.location, nullableToken.location),
      type: namedType,
    };

    return nullableType;
  }

  private parseVariableDeclaration(mutabilityToken: Token): VariableDeclarationNode {
    const nameToken: Token = this.consume(TokenType.Identifier, 'Expected a variable name.');
    const nameNode: IdentifierNode = this.createIdentifierNode(nameToken);

    this.consume(TokenType.Colon, 'Expected ":" after the variable name.');

    const typeNode: TypeNode = this.parseType();

    this.consume(TokenType.Equal, 'Expected "=" after the variable type.');

    const initializerNode: ExpressionNode = this.parseExpression();
    const semicolonToken: Token = this.consume(TokenType.Semicolon, 'Expected ";" after the declaration.');

    return {
      initializer: initializerNode,
      kind: 'VariableDeclaration',
      location: this.mergeLocations(mutabilityToken.location, semicolonToken.location),
      mutability: mutabilityToken.type === TokenType.Var ? 'var' : 'val',
      name: nameNode,
      type: typeNode,
    };
  }

  private peek(): Token {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1] ?? this.createUnexpectedTokenError();
  }

  private previous(): Token {
    return this.tokens[this.index - 1] ?? this.tokens[0] ?? this.createUnexpectedTokenError();
  }
}
