import type { BaseNode } from './base-node.js';

export type BooleanLiteralNode = BaseNode & {
  kind: 'BooleanLiteral';
  value: boolean;
};

export type DoubleLiteralNode = BaseNode & {
  kind: 'DoubleLiteral';
  value: number;
};

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

export type ExpressionNode =
  | BooleanLiteralNode
  | DoubleLiteralNode
  | IntegerLiteralNode
  | NullLiteralNode
  | StringLiteralNode;
