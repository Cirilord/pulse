import type { BaseNode } from './base-node.js';
import type { BlockStatementNode } from './block-statement-node.js';
import type { ExpressionNode } from './expression-node.js';

export type WhileStatementNode = BaseNode & {
  body: BlockStatementNode;
  condition: ExpressionNode;
  kind: 'WhileStatement';
};
