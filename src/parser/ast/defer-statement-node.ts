import type { BaseNode } from './base-node.js';
import type { ExpressionNode } from './expression-node.js';

export type DeferStatementNode = BaseNode & {
  expression: ExpressionNode;
  kind: 'DeferStatement';
};
