import type { BaseNode } from './base-node.js';
import type { StatementNode } from './statement-node.js';

export type ProgramNode = BaseNode & {
  body: StatementNode[];
  kind: 'Program';
};
