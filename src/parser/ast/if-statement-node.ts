import type { BaseNode } from './base-node.js';
import type { BlockStatementNode } from './block-statement-node.js';
import type { ExpressionNode } from './expression-node.js';

export type IfStatementNode = BaseNode & {
  condition: ExpressionNode;
  elseBranch: BlockStatementNode | IfStatementNode | null;
  kind: 'IfStatement';
  thenBranch: BlockStatementNode;
};
