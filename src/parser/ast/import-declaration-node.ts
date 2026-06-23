import type { BaseNode } from './base-node.js';
import type { IdentifierNode } from './identifier-node.js';

export type ImportDeclarationNode = BaseNode & {
  importAll: boolean;
  isExported: boolean;
  kind: 'ImportDeclaration';
  namedImports: IdentifierNode[];
  namespaceImport: IdentifierNode | null;
  source: string;
};
