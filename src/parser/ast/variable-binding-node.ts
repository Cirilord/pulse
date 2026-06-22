import type { BaseNode } from './base-node.js';
import type { IdentifierNode } from './identifier-node.js';
import type { TypeNode } from './type-node.js';

export type VariableBindingNode = BaseNode & {
  kind: 'VariableBinding';
  mutability: 'val' | 'var';
  name: IdentifierNode;
  type: TypeNode;
};
