import type { BaseNode } from './base-node.js';

export type ContinueStatementNode = BaseNode & {
  kind: 'ContinueStatement';
};
