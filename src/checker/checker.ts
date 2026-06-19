import type { PrimitiveTypeName, ResolvedType } from './types.js';
import { type TokenLocation } from '../lexer/token.js';
import type {
  AssignmentExpressionNode,
  BinaryExpressionNode,
  BlockStatementNode,
  BreakStatementNode,
  ConditionalExpressionNode,
  ContinueStatementNode,
  DoWhileStatementNode,
  ExpressionNode,
  ExpressionStatementNode,
  IdentifierExpressionNode,
  IfStatementNode,
  NamedTypeNode,
  ProgramNode,
  StatementNode,
  TypeNode,
  UnaryExpressionNode,
  VariableDeclarationNode,
  WhileStatementNode,
} from '../parser/ast/index.js';

const PRIMITIVE_TYPES: ReadonlySet<string> = new Set<PrimitiveTypeName>([
  'boolean',
  'byte',
  'char',
  'double',
  'float',
  'int',
  'string',
  'void',
]);

type SymbolEntry = {
  mutability: 'val' | 'var';
  type: ResolvedType;
};

export class CheckerError extends Error {
  public readonly location: TokenLocation;

  public constructor(message: string, location: TokenLocation) {
    super(message);
    this.location = location;
    this.name = 'CheckerError';
  }
}

export class Checker {
  private loopDepth: number;

  private readonly scopes: Map<string, SymbolEntry>[];

  public constructor() {
    this.loopDepth = 0;
    this.scopes = [];
  }

  public checkProgram(program: ProgramNode): void {
    this.loopDepth = 0;
    this.scopes.length = 0;
    this.pushScope();

    for (const statement of program.body) {
      this.checkStatement(statement);
    }

    this.popScope();
  }

  private assertExpressionAssignable(targetType: ResolvedType, expression: ExpressionNode): void {
    if (expression.kind === 'NullLiteral') {
      if (!targetType.nullable) {
        throw new CheckerError(`Type "${targetType.name}" does not allow null.`, expression.location);
      }

      return;
    }

    if (targetType.name === 'byte' && expression.kind === 'IntegerLiteral') {
      if (expression.value < 0 || expression.value > 255) {
        throw new CheckerError('Byte literals must be between 0 and 255.', expression.location);
      }

      return;
    }

    if (targetType.name === 'float' && expression.kind === 'DoubleLiteral') {
      return;
    }

    if (targetType.name === 'char' && expression.kind === 'StringLiteral') {
      if (expression.value.length !== 1) {
        throw new CheckerError('Char values must contain exactly one character.', expression.location);
      }

      return;
    }

    const expressionType: ResolvedType = this.resolveExpressionType(expression);

    if (targetType.name !== expressionType.name || targetType.nullable !== expressionType.nullable) {
      throw new CheckerError(
        `Cannot assign "${this.stringifyType(expressionType)}" to "${this.stringifyType(targetType)}".`,
        expression.location
      );
    }
  }

  private checkAssignmentExpression(expression: AssignmentExpressionNode): ResolvedType {
    const targetSymbol: SymbolEntry = this.resolveIdentifier(expression.target);

    if (targetSymbol.mutability !== 'var') {
      throw new CheckerError(
        `Cannot reassign immutable value "${expression.target.name}".`,
        expression.target.location
      );
    }

    if (expression.operator === '=') {
      this.assertExpressionAssignable(targetSymbol.type, expression.value);
      return targetSymbol.type;
    }

    if (expression.operator === '&&=' || expression.operator === '||=') {
      if (targetSymbol.type.nullable || targetSymbol.type.name !== 'boolean') {
        throw new CheckerError(
          `Operator "${expression.operator}" can only be used with boolean variables.`,
          expression.location
        );
      }

      const valueType: ResolvedType = this.resolveExpressionType(expression.value);

      if (valueType.nullable || valueType.name !== 'boolean') {
        throw new CheckerError(`Operator "${expression.operator}" requires boolean operands.`, expression.location);
      }

      return targetSymbol.type;
    }

    if (expression.operator === '??=') {
      if (!targetSymbol.type.nullable) {
        throw new CheckerError('Operator "??=" can only be used with nullable variables.', expression.location);
      }

      if (expression.value.kind === 'NullLiteral') {
        return targetSymbol.type;
      }

      const valueType: ResolvedType = this.resolveExpressionType(expression.value);

      if (valueType.name !== targetSymbol.type.name) {
        throw new CheckerError(
          `Operator "??=" cannot combine "${this.stringifyType(targetSymbol.type)}" with "${this.stringifyType(valueType)}".`,
          expression.location
        );
      }

      return targetSymbol.type;
    }

    if (this.isBitwiseAssignmentOperator(expression.operator)) {
      if (!this.isBitwiseType(targetSymbol.type.name)) {
        throw new CheckerError(
          `Operator "${expression.operator}" can only be used with int and byte variables.`,
          expression.location
        );
      }

      const valueType: ResolvedType = this.resolveExpressionType(expression.value);

      if (valueType.nullable || !this.isBitwiseType(valueType.name)) {
        throw new CheckerError(`Operator "${expression.operator}" requires int or byte operands.`, expression.location);
      }

      return targetSymbol.type;
    }

    if (!this.isNumericType(targetSymbol.type.name)) {
      throw new CheckerError(
        `Operator "${expression.operator}" can only be used with numeric variables.`,
        expression.location
      );
    }

    if (expression.operator === '%=' && !this.isModuloCompatibleType(targetSymbol.type.name)) {
      throw new CheckerError('Operator "%=" can only be used with int and byte values.', expression.location);
    }

    this.assertExpressionAssignable(targetSymbol.type, expression.value);

    return targetSymbol.type;
  }

  private checkBinaryExpression(expression: BinaryExpressionNode): ResolvedType {
    if (expression.operator === '??') {
      return this.resolveNullCoalescingExpressionType(expression);
    }

    if (expression.operator === '==' || expression.operator === '!=') {
      return this.resolveEqualityExpressionType(expression);
    }

    const leftType: ResolvedType = this.resolveExpressionType(expression.left);
    const rightType: ResolvedType = this.resolveExpressionType(expression.right);

    if (leftType.nullable || rightType.nullable) {
      throw new CheckerError('Binary operators do not support nullable operands.', expression.location);
    }

    if (leftType.name !== rightType.name) {
      throw new CheckerError(
        `Cannot use operator "${expression.operator}" with "${leftType.name}" and "${rightType.name}".`,
        expression.location
      );
    }

    if (expression.operator === '&&' || expression.operator === '||') {
      if (leftType.name !== 'boolean') {
        throw new CheckerError(
          `Operator "${expression.operator}" can only be used with boolean operands.`,
          expression.location
        );
      }

      return { name: 'boolean', nullable: false };
    }

    if (this.isBitwiseBinaryOperator(expression.operator)) {
      if (!this.isBitwiseType(leftType.name)) {
        throw new CheckerError(
          `Operator "${expression.operator}" can only be used with int and byte operands.`,
          expression.location
        );
      }

      if (expression.operator === '<<' || expression.operator === '>>') {
        return leftType;
      }

      return leftType;
    }

    if (!this.isNumericType(leftType.name)) {
      throw new CheckerError(
        `Operator "${expression.operator}" can only be used with numeric operands.`,
        expression.location
      );
    }

    if (expression.operator === '%' && !this.isModuloCompatibleType(leftType.name)) {
      throw new CheckerError('Operator "%" can only be used with int and byte values.', expression.location);
    }

    if (
      expression.operator === '<' ||
      expression.operator === '<=' ||
      expression.operator === '>' ||
      expression.operator === '>='
    ) {
      return { name: 'boolean', nullable: false };
    }

    return leftType;
  }

  private checkBlockStatement(statement: BlockStatementNode): void {
    this.pushScope();

    for (const innerStatement of statement.body) {
      this.checkStatement(innerStatement);
    }

    this.popScope();
  }

  private checkBreakStatement(statement: BreakStatementNode): void {
    if (this.loopDepth === 0) {
      throw new CheckerError('"break" can only be used inside a loop.', statement.location);
    }
  }

  private checkConditionalExpression(expression: ConditionalExpressionNode): ResolvedType {
    const conditionType: ResolvedType = this.resolveExpressionType(expression.condition);

    if (conditionType.nullable || conditionType.name !== 'boolean') {
      throw new CheckerError(
        'Conditional expressions require a non-nullable boolean condition.',
        expression.condition.location
      );
    }

    if (expression.thenExpression.kind === 'NullLiteral' && expression.elseExpression.kind === 'NullLiteral') {
      throw new CheckerError('Conditional expressions cannot use null in both branches.', expression.location);
    }

    if (expression.thenExpression.kind === 'NullLiteral') {
      const elseType: ResolvedType = this.resolveExpressionType(expression.elseExpression);

      if (!elseType.nullable) {
        throw new CheckerError(
          'Null branches in conditional expressions require a nullable opposite branch.',
          expression.thenExpression.location
        );
      }

      return elseType;
    }

    if (expression.elseExpression.kind === 'NullLiteral') {
      const thenType: ResolvedType = this.resolveExpressionType(expression.thenExpression);

      if (!thenType.nullable) {
        throw new CheckerError(
          'Null branches in conditional expressions require a nullable opposite branch.',
          expression.elseExpression.location
        );
      }

      return thenType;
    }

    const thenType: ResolvedType = this.resolveExpressionType(expression.thenExpression);
    const elseType: ResolvedType = this.resolveExpressionType(expression.elseExpression);

    if (thenType.name !== elseType.name || thenType.nullable !== elseType.nullable) {
      throw new CheckerError(
        `Conditional expression branches must have matching types, got "${this.stringifyType(thenType)}" and "${this.stringifyType(elseType)}".`,
        expression.location
      );
    }

    return thenType;
  }

  private checkContinueStatement(statement: ContinueStatementNode): void {
    if (this.loopDepth === 0) {
      throw new CheckerError('"continue" can only be used inside a loop.', statement.location);
    }
  }

  private checkDoWhileStatement(statement: DoWhileStatementNode): void {
    const conditionType: ResolvedType = this.resolveExpressionType(statement.condition);

    if (conditionType.nullable || conditionType.name !== 'boolean') {
      throw new CheckerError(
        'Do-while statements require a non-nullable boolean condition.',
        statement.condition.location
      );
    }

    this.loopDepth += 1;
    this.checkBlockStatement(statement.body);
    this.loopDepth -= 1;
  }

  private checkExpressionStatement(statement: ExpressionStatementNode): void {
    this.resolveExpressionType(statement.expression);
  }

  private checkIfStatement(statement: IfStatementNode): void {
    const conditionType: ResolvedType = this.resolveExpressionType(statement.condition);

    if (conditionType.nullable || conditionType.name !== 'boolean') {
      throw new CheckerError('If statements require a non-nullable boolean condition.', statement.condition.location);
    }

    this.checkBlockStatement(statement.thenBranch);

    if (statement.elseBranch === null) {
      return;
    }

    if (statement.elseBranch.kind === 'BlockStatement') {
      this.checkBlockStatement(statement.elseBranch);
      return;
    }

    this.checkIfStatement(statement.elseBranch);
  }

  private checkStatement(statement: StatementNode): void {
    switch (statement.kind) {
      case 'BlockStatement':
        this.checkBlockStatement(statement);
        return;
      case 'BreakStatement':
        this.checkBreakStatement(statement);
        return;
      case 'ContinueStatement':
        this.checkContinueStatement(statement);
        return;
      case 'DoWhileStatement':
        this.checkDoWhileStatement(statement);
        return;
      case 'ExpressionStatement':
        this.checkExpressionStatement(statement);
        return;
      case 'IfStatement':
        this.checkIfStatement(statement);
        return;
      case 'VariableDeclaration':
        this.checkVariableDeclaration(statement);
        return;
      case 'WhileStatement':
        this.checkWhileStatement(statement);
        return;
    }
  }

  private checkVariableDeclaration(declaration: VariableDeclarationNode): void {
    const currentScope: Map<string, SymbolEntry> = this.peekScope();

    if (currentScope.has(declaration.name.name)) {
      throw new CheckerError(`Variable "${declaration.name.name}" is already declared.`, declaration.name.location);
    }

    const declaredType: ResolvedType = this.resolveType(declaration.type);

    if (declaredType.name === 'void') {
      throw new CheckerError('Variables cannot use the void type.', declaration.type.location);
    }

    this.assertExpressionAssignable(declaredType, declaration.initializer);

    currentScope.set(declaration.name.name, {
      mutability: declaration.mutability,
      type: declaredType,
    });
  }

  private checkWhileStatement(statement: WhileStatementNode): void {
    const conditionType: ResolvedType = this.resolveExpressionType(statement.condition);

    if (conditionType.nullable || conditionType.name !== 'boolean') {
      throw new CheckerError(
        'While statements require a non-nullable boolean condition.',
        statement.condition.location
      );
    }

    this.loopDepth += 1;
    this.checkBlockStatement(statement.body);
    this.loopDepth -= 1;
  }

  private isBitwiseAssignmentOperator(operator: AssignmentExpressionNode['operator']): boolean {
    return operator === '&=' || operator === '<<=' || operator === '>>=' || operator === '^=' || operator === '|=';
  }

  private isBitwiseBinaryOperator(operator: BinaryExpressionNode['operator']): boolean {
    return operator === '&' || operator === '<<' || operator === '>>' || operator === '^' || operator === '|';
  }

  private isBitwiseType(typeName: PrimitiveTypeName): boolean {
    return typeName === 'byte' || typeName === 'int';
  }

  private isModuloCompatibleType(typeName: PrimitiveTypeName): boolean {
    return typeName === 'byte' || typeName === 'int';
  }

  private isNumericType(typeName: PrimitiveTypeName): boolean {
    return typeName === 'byte' || typeName === 'double' || typeName === 'float' || typeName === 'int';
  }

  private peekScope(): Map<string, SymbolEntry> {
    const scope: Map<string, SymbolEntry> | undefined = this.scopes.at(-1);

    if (scope === undefined) {
      throw new Error('Checker requires at least one active scope.');
    }

    return scope;
  }

  private popScope(): void {
    const scope: Map<string, SymbolEntry> | undefined = this.scopes.pop();

    if (scope === undefined) {
      throw new Error('Checker cannot pop an empty scope stack.');
    }
  }

  private pushScope(): void {
    this.scopes.push(new Map<string, SymbolEntry>());
  }

  private resolveEqualityExpressionType(expression: BinaryExpressionNode): ResolvedType {
    if (expression.left.kind === 'NullLiteral' && expression.right.kind === 'NullLiteral') {
      return { name: 'boolean', nullable: false };
    }

    if (expression.left.kind === 'NullLiteral') {
      const rightType: ResolvedType = this.resolveExpressionType(expression.right);

      if (!rightType.nullable) {
        throw new CheckerError(`Cannot compare "${this.stringifyType(rightType)}" with "null".`, expression.location);
      }

      return { name: 'boolean', nullable: false };
    }

    if (expression.right.kind === 'NullLiteral') {
      const leftType: ResolvedType = this.resolveExpressionType(expression.left);

      if (!leftType.nullable) {
        throw new CheckerError(`Cannot compare "${this.stringifyType(leftType)}" with "null".`, expression.location);
      }

      return { name: 'boolean', nullable: false };
    }

    const leftType: ResolvedType = this.resolveExpressionType(expression.left);
    const rightType: ResolvedType = this.resolveExpressionType(expression.right);

    if (leftType.name !== rightType.name || leftType.nullable !== rightType.nullable) {
      throw new CheckerError(
        `Cannot use operator "${expression.operator}" with "${this.stringifyType(leftType)}" and "${this.stringifyType(rightType)}".`,
        expression.location
      );
    }

    return { name: 'boolean', nullable: false };
  }

  private resolveExpressionType(expression: ExpressionNode): ResolvedType {
    switch (expression.kind) {
      case 'AssignmentExpression':
        return this.checkAssignmentExpression(expression);
      case 'BinaryExpression':
        return this.checkBinaryExpression(expression);
      case 'BooleanLiteral':
        return { name: 'boolean', nullable: false };
      case 'ConditionalExpression':
        return this.checkConditionalExpression(expression);
      case 'DoubleLiteral':
        return { name: 'double', nullable: false };
      case 'GroupingExpression':
        return this.resolveExpressionType(expression.expression);
      case 'IdentifierExpression':
        return this.resolveIdentifier(expression).type;
      case 'IntegerLiteral':
        return { name: 'int', nullable: false };
      case 'StringLiteral':
        return { name: 'string', nullable: false };
      case 'NullLiteral':
        throw new CheckerError('Null must be handled before resolving an expression type.', expression.location);
      case 'UnaryExpression':
        return this.resolveUnaryExpressionType(expression);
    }
  }

  private resolveIdentifier(expression: IdentifierExpressionNode): SymbolEntry {
    for (let index = this.scopes.length - 1; index >= 0; index -= 1) {
      const symbol: SymbolEntry | undefined = this.scopes[index]?.get(expression.name);

      if (symbol !== undefined) {
        return symbol;
      }
    }

    throw new CheckerError(`Unknown variable "${expression.name}".`, expression.location);
  }

  private resolveNamedType(type: NamedTypeNode): PrimitiveTypeName {
    if (!PRIMITIVE_TYPES.has(type.name)) {
      throw new CheckerError(`Unknown type "${type.name}".`, type.location);
    }

    return type.name as PrimitiveTypeName;
  }

  private resolveNullCoalescingExpressionType(expression: BinaryExpressionNode): ResolvedType {
    if (expression.left.kind === 'NullLiteral') {
      if (expression.right.kind === 'NullLiteral') {
        throw new CheckerError('Operator "??" cannot coalesce null with null.', expression.location);
      }

      return this.resolveExpressionType(expression.right);
    }

    const leftType: ResolvedType = this.resolveExpressionType(expression.left);

    if (!leftType.nullable) {
      throw new CheckerError(
        'Operator "??" requires a nullable left operand or a null literal.',
        expression.left.location
      );
    }

    if (expression.right.kind === 'NullLiteral') {
      return leftType;
    }

    const rightType: ResolvedType = this.resolveExpressionType(expression.right);

    if (leftType.name !== rightType.name) {
      throw new CheckerError(
        `Operator "??" cannot combine "${this.stringifyType(leftType)}" with "${this.stringifyType(rightType)}".`,
        expression.location
      );
    }

    return {
      name: leftType.name,
      nullable: rightType.nullable,
    };
  }

  private resolveType(type: TypeNode): ResolvedType {
    if (type.kind === 'NamedType') {
      return {
        name: this.resolveNamedType(type),
        nullable: false,
      };
    }

    return {
      name: this.resolveNamedType(type.type),
      nullable: true,
    };
  }

  private resolveUnaryExpressionType(expression: UnaryExpressionNode): ResolvedType {
    const operandType: ResolvedType = this.resolveExpressionType(expression.expression);

    if (operandType.nullable) {
      throw new CheckerError(
        `Operator "${expression.operator}" does not support nullable operands.`,
        expression.location
      );
    }

    switch (expression.operator) {
      case '!':
        if (operandType.name !== 'boolean') {
          throw new CheckerError('Operator "!" can only be used with boolean operands.', expression.location);
        }

        return { name: 'boolean', nullable: false };
      case '+':
      case '-':
        if (!this.isNumericType(operandType.name)) {
          throw new CheckerError(
            `Operator "${expression.operator}" can only be used with numeric operands.`,
            expression.location
          );
        }

        return operandType;
      case '~':
        if (!this.isBitwiseType(operandType.name)) {
          throw new CheckerError('Operator "~" can only be used with int and byte operands.', expression.location);
        }

        return operandType;
    }
  }

  private stringifyType(type: ResolvedType): string {
    return type.nullable ? `${type.name}?` : type.name;
  }
}
