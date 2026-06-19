import type { BaseNode } from './base-node.js';
import type { IdentifierNode } from './identifier-node.js';
import type { TypeNode } from './type-node.js';

export type AccessModifier = 'private' | 'public';

export type ClassFieldDeclarationNode = BaseNode & {
  access: AccessModifier;
  kind: 'ClassFieldDeclaration';
  mutability: 'val' | 'var';
  name: IdentifierNode;
  type: TypeNode;
};
