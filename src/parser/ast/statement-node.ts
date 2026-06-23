import type { BlockStatementNode } from './block-statement-node.js';
import type { BreakStatementNode } from './break-statement-node.js';
import type { ContinueStatementNode } from './continue-statement-node.js';
import type { DeferStatementNode } from './defer-statement-node.js';
import type { DoWhileStatementNode } from './do-while-statement-node.js';
import type { ExpressionStatementNode } from './expression-statement-node.js';
import type { ForStatementNode } from './for-statement-node.js';
import type { IfStatementNode } from './if-statement-node.js';
import type { MultiVariableDeclarationNode } from './multi-variable-declaration-node.js';
import type { ReturnStatementNode } from './return-statement-node.js';
import type { VariableDeclarationNode } from './variable-declaration-node.js';
import type { WhileStatementNode } from './while-statement-node.js';

export type StatementNode =
  | BlockStatementNode
  | BreakStatementNode
  | ContinueStatementNode
  | DeferStatementNode
  | DoWhileStatementNode
  | ExpressionStatementNode
  | ForStatementNode
  | IfStatementNode
  | MultiVariableDeclarationNode
  | ReturnStatementNode
  | VariableDeclarationNode
  | WhileStatementNode;
