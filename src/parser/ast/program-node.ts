import type { BaseNode } from './base-node.js';
import type { TopLevelNode } from './top-level-node.js';

export type ProgramNode = BaseNode & {
  body: TopLevelNode[];
  kind: 'Program';
};
