import type { BaseNode } from './base-node.js';
import type { StatementNode } from './statement-node.js';

export type BlockStatementNode = BaseNode & {
  body: StatementNode[];
  kind: 'BlockStatement';
};
