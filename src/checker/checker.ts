import type { PrimitiveTypeName, ResolvedType } from './types.js';
import { type TokenLocation } from '../lexer/token.js';
import type {
  ExpressionNode,
  NamedTypeNode,
  ProgramNode,
  TypeNode,
  VariableDeclarationNode,
} from '../parser/ast/index.js';

const PRIMITIVE_TYPES: ReadonlySet<string> = new Set<PrimitiveTypeName>(['int', 'string']);

export class CheckerError extends Error {
  public readonly location: TokenLocation;

  public constructor(message: string, location: TokenLocation) {
    super(message);
    this.location = location;
    this.name = 'CheckerError';
  }
}

export class Checker {
  public checkProgram(program: ProgramNode): void {
    for (const statement of program.body) {
      this.checkVariableDeclaration(statement);
    }
  }

  private assertExpressionAssignable(targetType: ResolvedType, expression: ExpressionNode): void {
    if (expression.kind === 'NullLiteral') {
      if (!targetType.nullable) {
        throw new CheckerError(`Type "${targetType.name}" does not allow null.`, expression.location);
      }

      return;
    }

    const expressionType: PrimitiveTypeName = this.resolveExpressionType(expression);

    if (targetType.name !== expressionType) {
      throw new CheckerError(
        `Cannot assign "${expressionType}" to "${this.stringifyType(targetType)}".`,
        expression.location
      );
    }
  }

  private checkVariableDeclaration(declaration: VariableDeclarationNode): void {
    const declaredType: ResolvedType = this.resolveType(declaration.type);

    this.assertExpressionAssignable(declaredType, declaration.initializer);
  }

  private resolveExpressionType(expression: ExpressionNode): PrimitiveTypeName {
    switch (expression.kind) {
      case 'IntegerLiteral':
        return 'int';
      case 'StringLiteral':
        return 'string';
      case 'NullLiteral':
        throw new CheckerError(
          'Null must be handled before resolving a primitive expression type.',
          expression.location
        );
    }
  }

  private resolveNamedType(type: NamedTypeNode): PrimitiveTypeName {
    if (!PRIMITIVE_TYPES.has(type.name)) {
      throw new CheckerError(`Unknown type "${type.name}".`, type.location);
    }

    return type.name as PrimitiveTypeName;
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

  private stringifyType(type: ResolvedType): string {
    return type.nullable ? `${type.name}?` : type.name;
  }
}
