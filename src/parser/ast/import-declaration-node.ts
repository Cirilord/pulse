import type { BaseNode } from './base-node.js';
import type { FunctionDeclarationNode } from './function-declaration-node.js';
import type { IdentifierNode } from './identifier-node.js';
import type { VariableDeclarationNode } from './variable-declaration-node.js';

export type ImportDeclarationNode = BaseNode & {
  externDeclarations: Array<FunctionDeclarationNode | VariableDeclarationNode>;
  importAll: boolean;
  isExported: boolean;
  isExtern: boolean;
  kind: 'ImportDeclaration';
  namedImports: IdentifierNode[];
  namespaceImport: IdentifierNode | null;
  source: string;
};
