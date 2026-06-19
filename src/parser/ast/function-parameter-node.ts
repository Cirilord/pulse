import type { BaseNode } from './base-node.js';
import type { IdentifierNode } from './identifier-node.js';
import type { TypeNode } from './type-node.js';

export type FunctionParameterNode = BaseNode & {
  kind: 'FunctionParameter';
  name: IdentifierNode;
  type: TypeNode;
};
