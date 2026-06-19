import type { BaseNode } from './base-node.js';
import type { ExpressionNode } from './expression-node.js';

export type ReturnStatementNode = BaseNode & {
  expression: ExpressionNode | null;
  kind: 'ReturnStatement';
};
