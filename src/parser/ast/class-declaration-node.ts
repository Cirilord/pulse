import type { BaseNode } from './base-node.js';
import type { ClassFieldDeclarationNode } from './class-field-declaration-node.js';
import type { ClassMethodDeclarationNode } from './class-method-declaration-node.js';
import type { IdentifierNode } from './identifier-node.js';

export type ClassMemberDeclarationNode = ClassFieldDeclarationNode | ClassMethodDeclarationNode;

export type ClassDeclarationNode = BaseNode & {
  baseName: IdentifierNode | null;
  isExported: boolean;
  kind: 'ClassDeclaration';
  members: ClassMemberDeclarationNode[];
  name: IdentifierNode;
};
