import type { BaseNode } from './base-node.js';

export type IntegerLiteralNode = BaseNode & {
  kind: 'IntegerLiteral';
  value: number;
};

export type NullLiteralNode = BaseNode & {
  kind: 'NullLiteral';
};

export type StringLiteralNode = BaseNode & {
  kind: 'StringLiteral';
  value: string;
};

export type ExpressionNode = IntegerLiteralNode | NullLiteralNode | StringLiteralNode;
