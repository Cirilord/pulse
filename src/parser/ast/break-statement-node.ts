import type { BaseNode } from './base-node.js';

export type BreakStatementNode = BaseNode & {
  kind: 'BreakStatement';
};
