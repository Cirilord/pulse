import type { BaseNode } from './base-node.js';
import type { ExpressionNode } from './expression-node.js';
import type { VariableBindingNode } from './variable-binding-node.js';

export type MultiVariableDeclarationNode = BaseNode & {
  bindings: VariableBindingNode[];
  initializer: ExpressionNode;
  kind: 'MultiVariableDeclaration';
};
