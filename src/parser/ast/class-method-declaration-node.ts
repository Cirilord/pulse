import type { BaseNode } from './base-node.js';
import type { BlockStatementNode } from './block-statement-node.js';
import type { AccessModifier } from './class-field-declaration-node.js';
import type { FunctionParameterNode } from './function-parameter-node.js';
import type { IdentifierNode } from './identifier-node.js';
import type { TypeNode } from './type-node.js';

export type ClassMethodDeclarationNode = BaseNode & {
  access: AccessModifier;
  body: BlockStatementNode;
  isConstructor: boolean;
  isOverride: boolean;
  isStatic: boolean;
  kind: 'ClassMethodDeclaration';
  name: IdentifierNode;
  parameters: FunctionParameterNode[];
  returnType: TypeNode | null;
  throws: TypeNode[];
};
