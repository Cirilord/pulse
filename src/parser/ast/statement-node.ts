import type { ExpressionStatementNode } from './expression-statement-node.js';
import type { VariableDeclarationNode } from './variable-declaration-node.js';

export type StatementNode = ExpressionStatementNode | VariableDeclarationNode;
