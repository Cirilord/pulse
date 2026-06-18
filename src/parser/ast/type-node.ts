import type { BaseNode } from './base-node.js';

export type NamedTypeNode = BaseNode & {
  kind: 'NamedType';
  name: string;
};

export type NullableTypeNode = BaseNode & {
  kind: 'NullableType';
  type: NamedTypeNode;
};

export type TypeNode = NamedTypeNode | NullableTypeNode;
