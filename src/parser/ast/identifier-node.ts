import type { BaseNode } from './base-node.js';

export type IdentifierNode = BaseNode & {
  kind: 'Identifier';
  name: string;
};
