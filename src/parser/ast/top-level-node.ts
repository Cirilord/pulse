import type { ClassDeclarationNode } from './class-declaration-node.js';
import type { FunctionDeclarationNode } from './function-declaration-node.js';
import type { ImportDeclarationNode } from './import-declaration-node.js';
import type { VariableDeclarationNode } from './variable-declaration-node.js';

export type TopLevelNode =
  | ClassDeclarationNode
  | FunctionDeclarationNode
  | ImportDeclarationNode
  | VariableDeclarationNode;
