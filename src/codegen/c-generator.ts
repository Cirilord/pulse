import { type TokenLocation } from '../lexer/token.js';
import type {
  ExpressionNode,
  ExpressionStatementNode,
  BinaryExpressionNode,
  ProgramNode,
  StatementNode,
  TypeNode,
  VariableDeclarationNode,
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
  private readonly variableTypes: Map<string, TypeNode>;

  public constructor() {
    this.variableTypes = new Map<string, TypeNode>();
  }

  public generateProgram(program: ProgramNode): string {
    const lines: string[] = ['#include <stdbool.h>', '#include <stddef.h>', ''];

    if (this.usesStringType(program)) {
      lines.push('typedef struct {');
      lines.push('  size_t length;');
      lines.push('  const char *data;');
      lines.push('} string_t;');
      lines.push('');
      lines.push('#define STRING_LITERAL(value) ((string_t){ sizeof(value) - 1, value })');
      lines.push('');
    }

    for (const nullableTypeName of this.collectNullableTypeNames(program)) {
      lines.push('typedef struct {');
      lines.push('  bool is_null;');
      lines.push(`  ${this.getNonNullableCType(nullableTypeName)} value;`);
      lines.push(`} ${this.getNullableCType(nullableTypeName)};`);
      lines.push('');
    }

    this.variableTypes.clear();

    lines.push('int main(void) {');

    for (const statement of program.body) {
      lines.push(`  ${this.generateStatement(statement)}`);
    }

    lines.push('  return 0;');
    lines.push('}');

    return `${lines.join('\n')}\n`;
  }

  private collectNullableTypeNames(program: ProgramNode): string[] {
    const typeNames: Set<string> = new Set<string>();

    for (const statement of program.body) {
      if (statement.kind === 'VariableDeclaration' && statement.type.kind === 'NullableType') {
        typeNames.add(statement.type.type.name);
      }
    }

    return [...typeNames].sort();
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

        return `(${this.generateExpression(expression.left)} ${expression.operator} ${this.generateExpression(expression.right)})`;
      case 'BooleanLiteral':
        return expression.value ? 'true' : 'false';
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

  private generateStatement(statement: StatementNode): string {
    switch (statement.kind) {
      case 'ExpressionStatement':
        return this.generateExpressionStatement(statement);
      case 'VariableDeclaration':
        return this.generateVariableDeclaration(statement);
    }
  }

  private generateType(type: TypeNode, mutability: 'val' | 'var'): string {
    if (type.kind === 'NullableType') {
      const nullableCType: string = this.getNullableCType(type.type.name);

      return mutability === 'val' ? `const ${nullableCType}` : nullableCType;
    }

    return this.getNonNullableType(type.name, mutability);
  }

  private generateVariableDeclaration(declaration: VariableDeclarationNode): string {
    const cType: string = this.generateType(declaration.type, declaration.mutability);
    const initializer: string = this.generateAssignedValue(declaration.type, declaration.initializer);

    this.variableTypes.set(declaration.name.name, declaration.type);

    return `${cType} ${declaration.name.name} = ${initializer};`;
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

  private resolveExpressionType(expression: ExpressionNode): TypeNode {
    switch (expression.kind) {
      case 'AssignmentExpression':
        return this.resolveVariableType(expression.target.name);
      case 'BinaryExpression':
        if (expression.operator === '??') {
          return this.resolveNullCoalescingType(expression);
        }

        return this.resolveNonNullableTypeNode(expression.left);
      case 'BooleanLiteral':
        return { kind: 'NamedType', location: expression.location, name: 'boolean' };
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
    const typeNode: TypeNode | undefined = this.variableTypes.get(name);

    if (typeNode === undefined) {
      throw new Error(`Unknown variable "${name}" in C generator.`);
    }

    return typeNode;
  }

  private usesStringType(program: ProgramNode): boolean {
    return program.body.some(function isStringDeclaration(statement: StatementNode): boolean {
      return (
        statement.kind === 'VariableDeclaration' &&
        ((statement.type.kind === 'NamedType' && statement.type.name === 'string') ||
          (statement.type.kind === 'NullableType' && statement.type.type.name === 'string'))
      );
    });
  }
}
