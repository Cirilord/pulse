import type { BaseNode } from './base-node.js';
import type { ExpressionNode } from './expression-node.js';
import type { IdentifierNode } from './identifier-node.js';
import type { TypeNode } from './type-node.js';

export type VariableDeclarationNode = BaseNode & {
  externName: string | null;
  externSource: string | null;
  initializer: ExpressionNode | null;
  isExported: boolean;
  isExtern: boolean;
  kind: 'VariableDeclaration';
  mutability: 'val' | 'var';
  name: IdentifierNode;
  type: TypeNode;
};
