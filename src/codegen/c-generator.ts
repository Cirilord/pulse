import { type TokenLocation } from '../lexer/token.js';
import type {
  BlockStatementNode,
  BreakStatementNode,
  ContinueStatementNode,
  DoWhileStatementNode,
  ExpressionNode,
  ExpressionStatementNode,
  BinaryExpressionNode,
  ConditionalExpressionNode,
  IfStatementNode,
  ProgramNode,
  StatementNode,
  TypeNode,
  VariableDeclarationNode,
  WhileStatementNode,
} from '../parser/ast/index.js';

export class CGeneratorError extends Error {
  public readonly location: TokenLocation;

  public constructor(message: string, location: TokenLocation) {
    super(message);
    this.location = location;
    this.name = 'CGeneratorError';
  }
}

export class CGenerator {
  private readonly scopes: Map<string, TypeNode>[];

  public constructor() {
    this.scopes = [];
  }

  public generateProgram(program: ProgramNode): string {
    this.scopes.length = 0;

    const usesStringType: boolean = this.usesStringType(program);
    const usesStringEquality: boolean = this.usesStringEquality(program);
    const lines: string[] = ['#include <stdbool.h>', '#include <stddef.h>'];

    this.scopes.length = 0;
    this.pushScope();

    if (usesStringEquality) {
      lines.push('#include <string.h>');
    }

    lines.push('');

    if (usesStringType) {
      lines.push('typedef struct {');
      lines.push('  size_t length;');
      lines.push('  const char *data;');
      lines.push('} string_t;');
      lines.push('');
      lines.push('#define STRING_LITERAL(value) ((string_t){ sizeof(value) - 1, value })');
      lines.push('');
    }

    if (usesStringEquality) {
      lines.push('static bool string_t_equal(const string_t left, const string_t right) {');
      lines.push('  if (left.length != right.length) {');
      lines.push('    return false;');
      lines.push('  }');
      lines.push('');
      lines.push('  if (left.length == 0) {');
      lines.push('    return true;');
      lines.push('  }');
      lines.push('');
      lines.push('  return memcmp(left.data, right.data, left.length) == 0;');
      lines.push('}');
      lines.push('');
    }

    for (const nullableTypeName of this.collectNullableTypeNames(program)) {
      lines.push('typedef struct {');
      lines.push('  bool is_null;');
      lines.push(`  ${this.getNonNullableCType(nullableTypeName)} value;`);
      lines.push(`} ${this.getNullableCType(nullableTypeName)};`);
      lines.push('');
    }

    lines.push('int main(void) {');

    for (const statement of program.body) {
      lines.push(...this.generateStatement(statement, 1));
    }

    lines.push('  return 0;');
    lines.push('}');

    this.popScope();

    return `${lines.join('\n')}\n`;
  }

  private collectNullableTypeNames(program: ProgramNode): string[] {
    const typeNames: Set<string> = new Set<string>();

    this.collectNullableTypeNamesFromStatements(program.body, typeNames);

    return [...typeNames].sort();
  }

  private collectNullableTypeNamesFromStatements(statements: StatementNode[], typeNames: Set<string>): void {
    for (const statement of statements) {
      if (statement.kind === 'BlockStatement') {
        this.collectNullableTypeNamesFromStatements(statement.body, typeNames);
        continue;
      }

      if (statement.kind === 'BreakStatement' || statement.kind === 'ContinueStatement') {
        continue;
      }

      if (statement.kind === 'DoWhileStatement') {
        this.collectNullableTypeNamesFromStatements(statement.body.body, typeNames);
        continue;
      }

      if (statement.kind === 'IfStatement') {
        this.collectNullableTypeNamesFromStatements(statement.thenBranch.body, typeNames);

        if (statement.elseBranch?.kind === 'BlockStatement') {
          this.collectNullableTypeNamesFromStatements(statement.elseBranch.body, typeNames);
        }

        if (statement.elseBranch?.kind === 'IfStatement') {
          this.collectNullableTypeNamesFromStatements([statement.elseBranch], typeNames);
        }

        continue;
      }

      if (statement.kind === 'WhileStatement') {
        this.collectNullableTypeNamesFromStatements(statement.body.body, typeNames);
        continue;
      }

      if (statement.kind === 'VariableDeclaration' && statement.type.kind === 'NullableType') {
        typeNames.add(statement.type.type.name);
      }
    }
  }

  private expressionUsesStringEquality(expression: ExpressionNode): boolean {
    switch (expression.kind) {
      case 'AssignmentExpression':
        return this.expressionUsesStringEquality(expression.value);
      case 'BinaryExpression':
        if (expression.operator === '==' || expression.operator === '!=') {
          return this.isStringEquality(expression);
        }

        return (
          this.expressionUsesStringEquality(expression.left) || this.expressionUsesStringEquality(expression.right)
        );
      case 'ConditionalExpression':
        return (
          this.expressionUsesStringEquality(expression.condition) ||
          this.expressionUsesStringEquality(expression.thenExpression) ||
          this.expressionUsesStringEquality(expression.elseExpression)
        );
      case 'GroupingExpression':
        return this.expressionUsesStringEquality(expression.expression);
      case 'UnaryExpression':
        return this.expressionUsesStringEquality(expression.expression);
      case 'BooleanLiteral':
      case 'DoubleLiteral':
      case 'IdentifierExpression':
      case 'IntegerLiteral':
      case 'NullLiteral':
      case 'StringLiteral':
        return false;
    }
  }

  private generateAssignedValue(type: TypeNode, expression: ExpressionNode): string {
    if (type.kind === 'NullableType') {
      if (expression.kind === 'NullLiteral') {
        return `(${this.getNullableCType(type.type.name)}){ .is_null = true, .value = ${this.getDefaultValue(type.type.name)} }`;
      }

      if (
        expression.kind === 'IdentifierExpression' &&
        this.resolveVariableType(expression.name).kind === 'NullableType'
      ) {
        return this.generateExpression(expression);
      }

      return `(${this.getNullableCType(type.type.name)}){ .is_null = false, .value = ${this.generateNonNullableValue(
        type.type.name,
        expression
      )} }`;
    }

    return this.generateNonNullableValue(type.name, expression);
  }

  private generateBlockStatement(statement: BlockStatementNode, indentLevel: number): string[] {
    return this.generateScopedBlock(statement.body, indentLevel, `${this.indent(indentLevel)}{`);
  }

  private generateBreakStatement(_statement: BreakStatementNode, indentLevel: number): string[] {
    return [`${this.indent(indentLevel)}break;`];
  }

  private generateConditionalExpression(expression: ConditionalExpressionNode): string {
    const resultType: TypeNode = this.resolveExpressionType(expression);
    const conditionExpression: string = this.generateExpression(expression.condition);
    const elseExpression: string = this.generateTypedExpression(resultType, expression.elseExpression);
    const thenExpression: string = this.generateTypedExpression(resultType, expression.thenExpression);

    return `(${conditionExpression} ? ${thenExpression} : ${elseExpression})`;
  }

  private generateContinueStatement(_statement: ContinueStatementNode, indentLevel: number): string[] {
    return [`${this.indent(indentLevel)}continue;`];
  }

  private generateDoWhileStatement(statement: DoWhileStatementNode, indentLevel: number): string[] {
    const lines: string[] = [`${this.indent(indentLevel)}do {`];

    this.pushScope();

    for (const bodyStatement of statement.body.body) {
      lines.push(...this.generateStatement(bodyStatement, indentLevel + 1));
    }

    this.popScope();
    lines.push(`${this.indent(indentLevel)}} while (${this.generateExpression(statement.condition)});`);

    return lines;
  }

  private generateEqualityExpression(expression: BinaryExpressionNode): string {
    if (expression.left.kind === 'NullLiteral' && expression.right.kind === 'NullLiteral') {
      return expression.operator === '==' ? 'true' : 'false';
    }

    if (expression.left.kind === 'NullLiteral') {
      const rightType: TypeNode = this.resolveExpressionType(expression.right);

      if (rightType.kind !== 'NullableType') {
        throw new CGeneratorError('Null equality requires a nullable operand.', expression.location);
      }

      const rightExpression: string = this.generateExpression(expression.right);

      return expression.operator === '==' ? `(${rightExpression}.is_null)` : `(!${rightExpression}.is_null)`;
    }

    if (expression.right.kind === 'NullLiteral') {
      const leftType: TypeNode = this.resolveExpressionType(expression.left);

      if (leftType.kind !== 'NullableType') {
        throw new CGeneratorError('Null equality requires a nullable operand.', expression.location);
      }

      const leftExpression: string = this.generateExpression(expression.left);

      return expression.operator === '==' ? `(${leftExpression}.is_null)` : `(!${leftExpression}.is_null)`;
    }

    const leftType: TypeNode = this.resolveExpressionType(expression.left);
    const rightType: TypeNode = this.resolveExpressionType(expression.right);

    if (leftType.kind === 'NullableType' || rightType.kind === 'NullableType') {
      return this.generateNullableEqualityExpression(expression, leftType, rightType);
    }

    if (
      leftType.kind === 'NamedType' &&
      leftType.name === 'string' &&
      rightType.kind === 'NamedType' &&
      rightType.name === 'string'
    ) {
      return `(string_t_equal(${this.generateExpression(expression.left)}, ${this.generateExpression(expression.right)})${
        expression.operator === '!=' ? ' == false' : ''
      })`;
    }

    return `(${this.generateExpression(expression.left)} ${expression.operator} ${this.generateExpression(expression.right)})`;
  }

  private generateExpression(expression: ExpressionNode): string {
    switch (expression.kind) {
      case 'AssignmentExpression':
        if (expression.operator === '&&=' || expression.operator === '||=') {
          return this.generateLogicalAssignmentExpression(expression);
        }

        if (expression.operator === '??=') {
          return this.generateNullCoalescingAssignmentExpression(expression);
        }

        return `${expression.target.name} ${expression.operator} ${this.generateAssignedValue(
          this.resolveVariableType(expression.target.name),
          expression.value
        )}`;
      case 'BinaryExpression':
        if (expression.operator === '??') {
          return this.generateNullCoalescingExpression(expression);
        }

        if (expression.operator === '==' || expression.operator === '!=') {
          return this.generateEqualityExpression(expression);
        }

        return `(${this.generateExpression(expression.left)} ${expression.operator} ${this.generateExpression(expression.right)})`;
      case 'BooleanLiteral':
        return expression.value ? 'true' : 'false';
      case 'ConditionalExpression':
        return this.generateConditionalExpression(expression);
      case 'DoubleLiteral':
        return String(expression.value);
      case 'GroupingExpression':
        return `(${this.generateExpression(expression.expression)})`;
      case 'IdentifierExpression':
        return expression.name;
      case 'IntegerLiteral':
        return String(expression.value);
      case 'NullLiteral':
        throw new CGeneratorError('Null literals must be emitted in a nullable context.', expression.location);
      case 'StringLiteral':
        return JSON.stringify(expression.value);
      case 'UnaryExpression':
        return `(${expression.operator}${this.generateExpression(expression.expression)})`;
    }
  }

  private generateExpressionStatement(statement: ExpressionStatementNode): string {
    return `${this.generateExpression(statement.expression)};`;
  }

  private generateIfStatement(statement: IfStatementNode, indentLevel: number, isElseIf: boolean = false): string[] {
    const openingLine: string = `${this.indent(indentLevel)}${isElseIf ? 'else if' : 'if'} (${this.generateExpression(statement.condition)}) {`;
    const lines: string[] = this.generateScopedBlock(statement.thenBranch.body, indentLevel, openingLine);

    if (statement.elseBranch === null) {
      return lines;
    }

    if (statement.elseBranch.kind === 'BlockStatement') {
      lines.push(
        ...this.generateScopedBlock(statement.elseBranch.body, indentLevel, `${this.indent(indentLevel)}else {`)
      );
      return lines;
    }

    lines.push(...this.generateIfStatement(statement.elseBranch, indentLevel, true));

    return lines;
  }

  private generateLogicalAssignmentExpression(expression: ExpressionNode & { kind: 'AssignmentExpression' }): string {
    const operator: string = expression.operator === '&&=' ? '&&' : '||';
    const valueExpression: string = this.generateExpression(expression.value);

    return `${expression.target.name} = (${expression.target.name} ${operator} ${valueExpression})`;
  }

  private generateNonNullableValue(typeName: string, expression: ExpressionNode): string {
    if (typeName === 'string' && expression.kind === 'StringLiteral') {
      return `STRING_LITERAL(${this.generateExpression(expression)})`;
    }

    if (typeName === 'char' && expression.kind === 'StringLiteral') {
      return `'${expression.value}'`;
    }

    if (typeName === 'float' && expression.kind === 'DoubleLiteral') {
      return `${this.generateExpression(expression)}f`;
    }

    return this.generateExpression(expression);
  }

  private generateNullCoalescingAssignmentExpression(
    expression: ExpressionNode & { kind: 'AssignmentExpression' }
  ): string {
    const targetType: TypeNode = this.resolveVariableType(expression.target.name);

    if (targetType.kind !== 'NullableType') {
      throw new CGeneratorError('Null coalescing assignment requires a nullable target.', expression.location);
    }

    const assignedValue: string = this.generateAssignedValue(targetType, expression.value);

    return `${expression.target.name} = (${expression.target.name}.is_null ? ${assignedValue} : ${expression.target.name})`;
  }

  private generateNullCoalescingExpression(expression: BinaryExpressionNode): string {
    const rightType: TypeNode = this.resolveExpressionType(expression.right);

    if (expression.left.kind === 'NullLiteral') {
      return rightType.kind === 'NullableType'
        ? this.generateExpression(expression.right)
        : this.generateNonNullableValue(rightType.name, expression.right);
    }

    const leftType: TypeNode = this.resolveExpressionType(expression.left);

    if (leftType.kind !== 'NullableType') {
      throw new CGeneratorError('Null coalescing requires a nullable left operand.', expression.left.location);
    }

    const leftExpression: string = this.generateExpression(expression.left);
    const rightExpression: string =
      rightType.kind === 'NullableType'
        ? this.generateExpression(expression.right)
        : this.generateNonNullableValue(rightType.name, expression.right);

    if (rightType.kind === 'NullableType') {
      return `(${leftExpression}.is_null ? ${rightExpression} : ${leftExpression})`;
    }

    return `(${leftExpression}.is_null ? ${rightExpression} : ${leftExpression}.value)`;
  }

  private generateNullableEqualityExpression(
    expression: BinaryExpressionNode,
    leftType: TypeNode,
    rightType: TypeNode
  ): string {
    if (leftType.kind !== 'NullableType' || rightType.kind !== 'NullableType') {
      throw new CGeneratorError('Nullable equality requires nullable operands.', expression.location);
    }

    const leftExpression: string = this.generateExpression(expression.left);
    const rightExpression: string = this.generateExpression(expression.right);
    const valueExpression: string =
      leftType.type.name === 'string'
        ? `string_t_equal(${leftExpression}.value, ${rightExpression}.value)`
        : `${leftExpression}.value == ${rightExpression}.value`;
    const equalityExpression: string = `(${leftExpression}.is_null ? ${rightExpression}.is_null : (!${rightExpression}.is_null && ${valueExpression}))`;

    if (expression.operator === '!=') {
      return `(!${equalityExpression})`;
    }

    return equalityExpression;
  }

  private generateScopedBlock(statements: StatementNode[], indentLevel: number, openingLine: string): string[] {
    const lines: string[] = [openingLine];

    this.pushScope();

    for (const statement of statements) {
      lines.push(...this.generateStatement(statement, indentLevel + 1));
    }

    this.popScope();
    lines.push(`${this.indent(indentLevel)}}`);

    return lines;
  }

  private generateStatement(statement: StatementNode, indentLevel: number): string[] {
    switch (statement.kind) {
      case 'BlockStatement':
        return this.generateBlockStatement(statement, indentLevel);
      case 'BreakStatement':
        return this.generateBreakStatement(statement, indentLevel);
      case 'ContinueStatement':
        return this.generateContinueStatement(statement, indentLevel);
      case 'DoWhileStatement':
        return this.generateDoWhileStatement(statement, indentLevel);
      case 'ExpressionStatement':
        return [`${this.indent(indentLevel)}${this.generateExpressionStatement(statement)}`];
      case 'IfStatement':
        return this.generateIfStatement(statement, indentLevel);
      case 'VariableDeclaration':
        return [`${this.indent(indentLevel)}${this.generateVariableDeclaration(statement)}`];
      case 'WhileStatement':
        return this.generateWhileStatement(statement, indentLevel);
    }
  }

  private generateType(type: TypeNode, mutability: 'val' | 'var'): string {
    if (type.kind === 'NullableType') {
      const nullableCType: string = this.getNullableCType(type.type.name);

      return mutability === 'val' ? `const ${nullableCType}` : nullableCType;
    }

    return this.getNonNullableType(type.name, mutability);
  }

  private generateTypedExpression(type: TypeNode, expression: ExpressionNode): string {
    if (type.kind === 'NullableType') {
      return this.generateAssignedValue(type, expression);
    }

    return this.generateNonNullableValue(type.name, expression);
  }

  private generateVariableDeclaration(declaration: VariableDeclarationNode): string {
    const cType: string = this.generateType(declaration.type, declaration.mutability);
    const initializer: string = this.generateAssignedValue(declaration.type, declaration.initializer);

    this.peekScope().set(declaration.name.name, declaration.type);

    return `${cType} ${declaration.name.name} = ${initializer};`;
  }

  private generateWhileStatement(statement: WhileStatementNode, indentLevel: number): string[] {
    const openingLine: string = `${this.indent(indentLevel)}while (${this.generateExpression(statement.condition)}) {`;

    return this.generateScopedBlock(statement.body.body, indentLevel, openingLine);
  }

  private getDefaultValue(typeName: string): string {
    switch (typeName) {
      case 'boolean':
        return 'false';
      case 'byte':
        return '0';
      case 'char':
        return "'\\0'";
      case 'double':
        return '0.0';
      case 'float':
        return '0.0f';
      case 'int':
        return '0';
      case 'string':
        return '(string_t){ .length = 0, .data = NULL }';
      default:
        throw new Error(`Unsupported default value for "${typeName}".`);
    }
  }

  private getNonNullableCType(typeName: string): string {
    switch (typeName) {
      case 'boolean':
        return 'bool';
      case 'byte':
        return 'unsigned char';
      case 'char':
        return 'char';
      case 'double':
        return 'double';
      case 'float':
        return 'float';
      case 'int':
        return 'int';
      case 'string':
        return 'string_t';
      default:
        throw new Error(`Unsupported C type for "${typeName}".`);
    }
  }

  private getNonNullableType(typeName: string, mutability: 'val' | 'var'): string {
    const cType: string = this.getNonNullableCType(typeName);

    return mutability === 'val' ? `const ${cType}` : cType;
  }

  private getNullableCType(typeName: string): string {
    return `${this.getNonNullableCType(typeName)}_nullable`;
  }

  private indent(level: number): string {
    return '  '.repeat(level);
  }

  private isStringEquality(expression: BinaryExpressionNode): boolean {
    if (expression.left.kind === 'NullLiteral' || expression.right.kind === 'NullLiteral') {
      const nonNullSide: ExpressionNode = expression.left.kind === 'NullLiteral' ? expression.right : expression.left;
      const nonNullType: TypeNode = this.resolveExpressionType(nonNullSide);

      return (
        (nonNullType.kind === 'NullableType' && nonNullType.type.name === 'string') ||
        (nonNullType.kind === 'NamedType' && nonNullType.name === 'string')
      );
    }

    const leftType: TypeNode = this.resolveExpressionType(expression.left);
    const rightType: TypeNode = this.resolveExpressionType(expression.right);

    return (
      ((leftType.kind === 'NullableType' && leftType.type.name === 'string') ||
        (leftType.kind === 'NamedType' && leftType.name === 'string')) &&
      ((rightType.kind === 'NullableType' && rightType.type.name === 'string') ||
        (rightType.kind === 'NamedType' && rightType.name === 'string'))
    );
  }

  private peekScope(): Map<string, TypeNode> {
    const scope: Map<string, TypeNode> | undefined = this.scopes.at(-1);

    if (scope === undefined) {
      throw new Error('C generator requires at least one active scope.');
    }

    return scope;
  }

  private popScope(): void {
    const scope: Map<string, TypeNode> | undefined = this.scopes.pop();

    if (scope === undefined) {
      throw new Error('C generator cannot pop an empty scope stack.');
    }
  }

  private pushScope(): void {
    this.scopes.push(new Map<string, TypeNode>());
  }

  private resolveConditionalExpressionType(expression: ConditionalExpressionNode): TypeNode {
    if (expression.thenExpression.kind === 'NullLiteral' && expression.elseExpression.kind === 'NullLiteral') {
      throw new CGeneratorError('Conditional expressions cannot use null in both branches.', expression.location);
    }

    if (expression.thenExpression.kind === 'NullLiteral') {
      return this.resolveExpressionType(expression.elseExpression);
    }

    if (expression.elseExpression.kind === 'NullLiteral') {
      return this.resolveExpressionType(expression.thenExpression);
    }

    return this.resolveExpressionType(expression.thenExpression);
  }

  private resolveExpressionType(expression: ExpressionNode): TypeNode {
    switch (expression.kind) {
      case 'AssignmentExpression':
        return this.resolveVariableType(expression.target.name);
      case 'BinaryExpression':
        if (expression.operator === '??') {
          return this.resolveNullCoalescingType(expression);
        }

        if (
          expression.operator === '&&' ||
          expression.operator === '||' ||
          expression.operator === '==' ||
          expression.operator === '!=' ||
          expression.operator === '<' ||
          expression.operator === '<=' ||
          expression.operator === '>' ||
          expression.operator === '>='
        ) {
          return { kind: 'NamedType', location: expression.location, name: 'boolean' };
        }

        return this.resolveNonNullableTypeNode(expression.left);
      case 'BooleanLiteral':
        return { kind: 'NamedType', location: expression.location, name: 'boolean' };
      case 'ConditionalExpression':
        return this.resolveConditionalExpressionType(expression);
      case 'DoubleLiteral':
        return { kind: 'NamedType', location: expression.location, name: 'double' };
      case 'GroupingExpression':
        return this.resolveExpressionType(expression.expression);
      case 'IdentifierExpression':
        return this.resolveVariableType(expression.name);
      case 'IntegerLiteral':
        return { kind: 'NamedType', location: expression.location, name: 'int' };
      case 'NullLiteral':
        throw new CGeneratorError('Null literals cannot be resolved without context.', expression.location);
      case 'StringLiteral':
        return { kind: 'NamedType', location: expression.location, name: 'string' };
      case 'UnaryExpression':
        if (expression.operator === '!') {
          return { kind: 'NamedType', location: expression.location, name: 'boolean' };
        }

        return this.resolveExpressionType(expression.expression);
    }
  }

  private resolveNonNullableTypeNode(expression: ExpressionNode): TypeNode {
    const typeNode: TypeNode = this.resolveExpressionType(expression);

    if (typeNode.kind === 'NullableType') {
      throw new CGeneratorError('Expected a non-nullable expression type.', expression.location);
    }

    return typeNode;
  }

  private resolveNullCoalescingType(expression: BinaryExpressionNode): TypeNode {
    if (expression.left.kind === 'NullLiteral') {
      return this.resolveExpressionType(expression.right);
    }

    const leftType: TypeNode = this.resolveExpressionType(expression.left);

    if (leftType.kind !== 'NullableType') {
      throw new CGeneratorError('Null coalescing requires a nullable left operand.', expression.left.location);
    }

    if (expression.right.kind === 'NullLiteral') {
      return leftType;
    }

    return this.resolveExpressionType(expression.right);
  }

  private resolveVariableType(name: string): TypeNode {
    for (let index = this.scopes.length - 1; index >= 0; index -= 1) {
      const typeNode: TypeNode | undefined = this.scopes[index]?.get(name);

      if (typeNode !== undefined) {
        return typeNode;
      }
    }

    throw new Error(`Unknown variable "${name}" in C generator.`);
  }

  private usesStringEquality(program: ProgramNode): boolean {
    this.scopes.length = 0;
    this.pushScope();
    const usesStringEquality: boolean = this.usesStringEqualityInStatements(program.body);
    this.popScope();

    return usesStringEquality;
  }

  private usesStringEqualityInStatements(statements: StatementNode[]): boolean {
    return statements.some((statement: StatementNode): boolean => {
      if (statement.kind === 'BlockStatement') {
        this.pushScope();

        const blockUsesStringEquality: boolean = this.usesStringEqualityInStatements(statement.body);

        this.popScope();

        return blockUsesStringEquality;
      }

      if (statement.kind === 'IfStatement') {
        if (this.expressionUsesStringEquality(statement.condition)) {
          return true;
        }

        this.pushScope();
        const thenBranchUsesStringEquality: boolean = this.usesStringEqualityInStatements(statement.thenBranch.body);
        this.popScope();

        if (thenBranchUsesStringEquality) {
          return true;
        }

        if (statement.elseBranch === null) {
          return false;
        }

        if (statement.elseBranch.kind === 'BlockStatement') {
          this.pushScope();
          const elseBranchUsesStringEquality: boolean = this.usesStringEqualityInStatements(statement.elseBranch.body);
          this.popScope();

          return elseBranchUsesStringEquality;
        }

        return this.usesStringEqualityInStatements([statement.elseBranch]);
      }

      if (statement.kind === 'DoWhileStatement') {
        if (this.expressionUsesStringEquality(statement.condition)) {
          return true;
        }

        this.pushScope();
        const bodyUsesStringEquality: boolean = this.usesStringEqualityInStatements(statement.body.body);
        this.popScope();

        return bodyUsesStringEquality;
      }

      if (statement.kind === 'BreakStatement' || statement.kind === 'ContinueStatement') {
        return false;
      }

      if (statement.kind === 'WhileStatement') {
        if (this.expressionUsesStringEquality(statement.condition)) {
          return true;
        }

        this.pushScope();
        const bodyUsesStringEquality: boolean = this.usesStringEqualityInStatements(statement.body.body);
        this.popScope();

        return bodyUsesStringEquality;
      }

      if (statement.kind === 'ExpressionStatement') {
        return this.expressionUsesStringEquality(statement.expression);
      }

      const declarationUsesStringEquality: boolean = this.expressionUsesStringEquality(statement.initializer);
      this.peekScope().set(statement.name.name, statement.type);

      if (declarationUsesStringEquality) {
        return true;
      }

      return false;
    });
  }

  private usesStringType(program: ProgramNode): boolean {
    return this.usesStringTypeInStatements(program.body);
  }

  private usesStringTypeInStatements(statements: StatementNode[]): boolean {
    return statements.some((statement: StatementNode): boolean => {
      if (statement.kind === 'BlockStatement') {
        return this.usesStringTypeInStatements(statement.body);
      }

      if (statement.kind === 'IfStatement') {
        return (
          this.usesStringTypeInStatements(statement.thenBranch.body) ||
          (statement.elseBranch?.kind === 'BlockStatement' &&
            this.usesStringTypeInStatements(statement.elseBranch.body)) ||
          (statement.elseBranch?.kind === 'IfStatement' && this.usesStringTypeInStatements([statement.elseBranch]))
        );
      }

      if (statement.kind === 'DoWhileStatement') {
        return this.usesStringTypeInStatements(statement.body.body);
      }

      if (statement.kind === 'WhileStatement') {
        return this.usesStringTypeInStatements(statement.body.body);
      }

      if (statement.kind === 'BreakStatement' || statement.kind === 'ContinueStatement') {
        return false;
      }

      return (
        statement.kind === 'VariableDeclaration' &&
        ((statement.type.kind === 'NamedType' && statement.type.name === 'string') ||
          (statement.type.kind === 'NullableType' && statement.type.type.name === 'string'))
      );
    });
  }
}
