import { TokenType } from '../lexer/token-type.js';
import type { Token, TokenLocation } from '../lexer/token.js';
import type {
  AssignmentExpressionNode,
  AssignmentOperator,
  BinaryExpressionNode,
  BinaryOperator,
  ExpressionNode,
  ExpressionStatementNode,
  IdentifierNode,
  IdentifierExpressionNode,
  NamedTypeNode,
  NullableTypeNode,
  ProgramNode,
  StatementNode,
  TypeNode,
  UnaryExpressionNode,
  UnaryOperator,
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

  private createIdentifierExpressionNode(token: Token): IdentifierExpressionNode {
    return {
      kind: 'IdentifierExpression',
      location: token.location,
      name: token.lexeme,
    };
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

  private parseAdditiveExpression(): ExpressionNode {
    let expression: ExpressionNode = this.parseMultiplicativeExpression();

    while (this.match(TokenType.Plus, TokenType.Minus)) {
      const operatorToken: Token = this.previous();
      const rightExpression: ExpressionNode = this.parseMultiplicativeExpression();
      const binaryExpression: BinaryExpressionNode = {
        kind: 'BinaryExpression',
        left: expression,
        location: this.mergeLocations(expression.location, rightExpression.location),
        operator: this.parseBinaryOperator(operatorToken),
        right: rightExpression,
      };

      expression = binaryExpression;
    }

    return expression;
  }

  private parseAssignmentExpression(): ExpressionNode {
    const leftExpression: ExpressionNode = this.parseLogicalOrExpression();

    if (
      !this.match(
        TokenType.Equal,
        TokenType.PlusEqual,
        TokenType.MinusEqual,
        TokenType.StarEqual,
        TokenType.SlashEqual,
        TokenType.PercentEqual
      )
    ) {
      return leftExpression;
    }

    const operatorToken: Token = this.previous();

    if (leftExpression.kind !== 'IdentifierExpression') {
      throw new ParserError('Expected an identifier on the left side of an assignment.', leftExpression.location);
    }

    const valueExpression: ExpressionNode = this.parseAssignmentExpression();
    const operator: AssignmentOperator = this.parseAssignmentOperator(operatorToken);
    const assignmentExpression: AssignmentExpressionNode = {
      kind: 'AssignmentExpression',
      location: this.mergeLocations(leftExpression.location, valueExpression.location),
      operator,
      target: leftExpression,
      value: valueExpression,
    };

    return assignmentExpression;
  }

  private parseAssignmentOperator(token: Token): AssignmentOperator {
    switch (token.type) {
      case TokenType.Equal:
        return '=';
      case TokenType.MinusEqual:
        return '-=';
      case TokenType.PercentEqual:
        return '%=';
      case TokenType.PlusEqual:
        return '+=';
      case TokenType.SlashEqual:
        return '/=';
      case TokenType.StarEqual:
        return '*=';
      default:
        throw new ParserError('Expected an assignment operator.', token.location);
    }
  }

  private parseBinaryOperator(token: Token): BinaryOperator {
    switch (token.type) {
      case TokenType.AmpersandAmpersand:
        return '&&';
      case TokenType.BangEqual:
        return '!=';
      case TokenType.EqualEqual:
        return '==';
      case TokenType.GreaterThan:
        return '>';
      case TokenType.GreaterThanEqual:
        return '>=';
      case TokenType.LessThan:
        return '<';
      case TokenType.LessThanEqual:
        return '<=';
      case TokenType.Minus:
        return '-';
      case TokenType.Percent:
        return '%';
      case TokenType.PipePipe:
        return '||';
      case TokenType.Plus:
        return '+';
      case TokenType.Slash:
        return '/';
      case TokenType.Star:
        return '*';
      default:
        throw new ParserError('Expected a binary operator.', token.location);
    }
  }

  private parseComparisonExpression(): ExpressionNode {
    let expression: ExpressionNode = this.parseAdditiveExpression();

    while (this.match(TokenType.GreaterThan, TokenType.GreaterThanEqual, TokenType.LessThan, TokenType.LessThanEqual)) {
      const operatorToken: Token = this.previous();
      const rightExpression: ExpressionNode = this.parseAdditiveExpression();
      const binaryExpression: BinaryExpressionNode = {
        kind: 'BinaryExpression',
        left: expression,
        location: this.mergeLocations(expression.location, rightExpression.location),
        operator: this.parseBinaryOperator(operatorToken),
        right: rightExpression,
      };

      expression = binaryExpression;
    }

    return expression;
  }

  private parseEqualityExpression(): ExpressionNode {
    let expression: ExpressionNode = this.parseComparisonExpression();

    while (this.match(TokenType.EqualEqual, TokenType.BangEqual)) {
      const operatorToken: Token = this.previous();
      const rightExpression: ExpressionNode = this.parseComparisonExpression();
      const binaryExpression: BinaryExpressionNode = {
        kind: 'BinaryExpression',
        left: expression,
        location: this.mergeLocations(expression.location, rightExpression.location),
        operator: this.parseBinaryOperator(operatorToken),
        right: rightExpression,
      };

      expression = binaryExpression;
    }

    return expression;
  }

  private parseExpression(): ExpressionNode {
    return this.parseAssignmentExpression();
  }

  private parseExpressionStatement(): ExpressionStatementNode {
    const expression: ExpressionNode = this.parseExpression();
    const semicolonToken: Token = this.consume(TokenType.Semicolon, 'Expected ";" after the expression.');

    return {
      expression,
      kind: 'ExpressionStatement',
      location: this.mergeLocations(expression.location, semicolonToken.location),
    };
  }

  private parseLogicalAndExpression(): ExpressionNode {
    let expression: ExpressionNode = this.parseEqualityExpression();

    while (this.match(TokenType.AmpersandAmpersand)) {
      const operatorToken: Token = this.previous();
      const rightExpression: ExpressionNode = this.parseEqualityExpression();
      const binaryExpression: BinaryExpressionNode = {
        kind: 'BinaryExpression',
        left: expression,
        location: this.mergeLocations(expression.location, rightExpression.location),
        operator: this.parseBinaryOperator(operatorToken),
        right: rightExpression,
      };

      expression = binaryExpression;
    }

    return expression;
  }

  private parseLogicalOrExpression(): ExpressionNode {
    let expression: ExpressionNode = this.parseLogicalAndExpression();

    while (this.match(TokenType.PipePipe)) {
      const operatorToken: Token = this.previous();
      const rightExpression: ExpressionNode = this.parseLogicalAndExpression();
      const binaryExpression: BinaryExpressionNode = {
        kind: 'BinaryExpression',
        left: expression,
        location: this.mergeLocations(expression.location, rightExpression.location),
        operator: this.parseBinaryOperator(operatorToken),
        right: rightExpression,
      };

      expression = binaryExpression;
    }

    return expression;
  }

  private parseMultiplicativeExpression(): ExpressionNode {
    let expression: ExpressionNode = this.parseUnaryExpression();

    while (this.match(TokenType.Star, TokenType.Slash, TokenType.Percent)) {
      const operatorToken: Token = this.previous();
      const rightExpression: ExpressionNode = this.parseUnaryExpression();
      const binaryExpression: BinaryExpressionNode = {
        kind: 'BinaryExpression',
        left: expression,
        location: this.mergeLocations(expression.location, rightExpression.location),
        operator: this.parseBinaryOperator(operatorToken),
        right: rightExpression,
      };

      expression = binaryExpression;
    }

    return expression;
  }

  private parsePrimaryExpression(): ExpressionNode {
    if (this.match(TokenType.Identifier)) {
      const token: Token = this.previous();

      return this.createIdentifierExpressionNode(token);
    }

    if (this.match(TokenType.True, TokenType.False)) {
      const token: Token = this.previous();

      return {
        kind: 'BooleanLiteral',
        location: token.location,
        value: token.type === TokenType.True,
      };
    }

    if (this.match(TokenType.DoubleLiteral)) {
      const token: Token = this.previous();

      return {
        kind: 'DoubleLiteral',
        location: token.location,
        value: Number(token.lexeme),
      };
    }

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

    return this.parseExpressionStatement();
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

  private parseUnaryExpression(): ExpressionNode {
    if (this.match(TokenType.Bang, TokenType.Minus, TokenType.Plus)) {
      const operatorToken: Token = this.previous();
      const expression: ExpressionNode = this.parseUnaryExpression();
      const unaryExpression: UnaryExpressionNode = {
        expression,
        kind: 'UnaryExpression',
        location: this.mergeLocations(operatorToken.location, expression.location),
        operator: this.parseUnaryOperator(operatorToken),
      };

      return unaryExpression;
    }

    return this.parsePrimaryExpression();
  }

  private parseUnaryOperator(token: Token): UnaryOperator {
    switch (token.type) {
      case TokenType.Bang:
        return '!';
      case TokenType.Minus:
        return '-';
      case TokenType.Plus:
        return '+';
      default:
        throw new ParserError('Expected a unary operator.', token.location);
    }
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
