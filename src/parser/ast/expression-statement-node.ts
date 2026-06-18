import type { BaseNode } from './base-node.js';
import type { ExpressionNode } from './expression-node.js';

export type ExpressionStatementNode = BaseNode & {
  expression: ExpressionNode;
  kind: 'ExpressionStatement';
};
