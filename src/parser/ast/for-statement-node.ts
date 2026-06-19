import type { BaseNode } from './base-node.js';
import type { BlockStatementNode } from './block-statement-node.js';
import type { ExpressionNode } from './expression-node.js';
import type { VariableDeclarationNode } from './variable-declaration-node.js';

export type ForInitializerNode = ExpressionNode | VariableDeclarationNode;

export type ForStatementNode = BaseNode & {
  body: BlockStatementNode;
  condition: ExpressionNode;
  initializer: ForInitializerNode;
  kind: 'ForStatement';
  update: ExpressionNode;
};
