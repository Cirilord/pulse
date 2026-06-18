import { type TokenLocation } from '../lexer/token.js';
import type { ExpressionNode, ProgramNode, TypeNode, VariableDeclarationNode } from '../parser/ast/index.js';

export class CGeneratorError extends Error {
  public readonly location: TokenLocation;

  public constructor(message: string, location: TokenLocation) {
    super(message);
    this.location = location;
    this.name = 'CGeneratorError';
  }
}

export class CGenerator {
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

    lines.push('int main(void) {');

    for (const statement of program.body) {
      lines.push(`  ${this.generateVariableDeclaration(statement)}`);
    }

    lines.push('  return 0;');
    lines.push('}');

    return `${lines.join('\n')}\n`;
  }

  private generateExpression(expression: ExpressionNode): string {
    switch (expression.kind) {
      case 'BooleanLiteral':
        return expression.value ? 'true' : 'false';
      case 'DoubleLiteral':
        return String(expression.value);
      case 'IntegerLiteral':
        return String(expression.value);
      case 'NullLiteral':
        return 'NULL';
      case 'StringLiteral':
        return JSON.stringify(expression.value);
    }
  }

  private generateType(type: TypeNode, mutability: 'val' | 'var'): string {
    if (type.kind === 'NullableType') {
      throw new CGeneratorError('Nullable types are not supported by the C generator yet.', type.location);
    }

    switch (type.name) {
      case 'boolean':
        return mutability === 'val' ? 'const bool' : 'bool';
      case 'byte':
        return mutability === 'val' ? 'const unsigned char' : 'unsigned char';
      case 'char':
        return mutability === 'val' ? 'const char' : 'char';
      case 'double':
        return mutability === 'val' ? 'const double' : 'double';
      case 'float':
        return mutability === 'val' ? 'const float' : 'float';
      case 'int':
        return mutability === 'val' ? 'const int' : 'int';
      case 'string':
        return mutability === 'val' ? 'const string_t' : 'string_t';
      default:
        throw new CGeneratorError(`Unsupported C type for "${type.name}".`, type.location);
    }
  }

  private generateVariableDeclaration(declaration: VariableDeclarationNode): string {
    const cType: string = this.generateType(declaration.type, declaration.mutability);
    const initializer: string =
      declaration.type.kind === 'NamedType' &&
      declaration.type.name === 'string' &&
      declaration.initializer.kind === 'StringLiteral'
        ? `STRING_LITERAL(${this.generateExpression(declaration.initializer)})`
        : declaration.type.kind === 'NamedType' &&
            declaration.type.name === 'char' &&
            declaration.initializer.kind === 'StringLiteral'
          ? `'${declaration.initializer.value}'`
          : declaration.type.kind === 'NamedType' &&
              declaration.type.name === 'float' &&
              declaration.initializer.kind === 'DoubleLiteral'
            ? `${this.generateExpression(declaration.initializer)}f`
            : this.generateExpression(declaration.initializer);

    return `${cType} ${declaration.name.name} = ${initializer};`;
  }

  private usesStringType(program: ProgramNode): boolean {
    return program.body.some(function isStringDeclaration(statement: VariableDeclarationNode): boolean {
      return statement.type.kind === 'NamedType' && statement.type.name === 'string';
    });
  }
}
