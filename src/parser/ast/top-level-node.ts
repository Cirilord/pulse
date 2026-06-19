import type { FunctionDeclarationNode } from './function-declaration-node.js';
import type { StatementNode } from './statement-node.js';

export type TopLevelNode = FunctionDeclarationNode | StatementNode;
