import type { BaseNode } from './base-node.js';
import type { BlockStatementNode } from './block-statement-node.js';
import type { FunctionParameterNode } from './function-parameter-node.js';
import type { IdentifierNode } from './identifier-node.js';
import type { TypeNode } from './type-node.js';

export type FunctionDeclarationNode = BaseNode & {
  body: BlockStatementNode;
  externSource: string | null;
  isExported: boolean;
  isExtern: boolean;
  kind: 'FunctionDeclaration';
  name: IdentifierNode;
  parameters: FunctionParameterNode[];
  returnType: TypeNode;
  throws: TypeNode[];
};
