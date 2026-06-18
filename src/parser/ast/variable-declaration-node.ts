import type { BaseNode } from './base-node.js';
import type { ExpressionNode } from './expression-node.js';
import type { IdentifierNode } from './identifier-node.js';
import type { TypeNode } from './type-node.js';

export type VariableDeclarationNode = BaseNode & {
  initializer: ExpressionNode;
  kind: 'VariableDeclaration';
  mutability: 'val' | 'var';
  name: IdentifierNode;
  type: TypeNode;
};
