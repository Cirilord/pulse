import type { BaseNode } from './base-node.js';
import type { IdentifierNode } from './identifier-node.js';

export type AssignmentOperator =
  | '='
  | '&&='
  | '&='
  | '<<='
  | '||='
  | '??='
  | '>>='
  | '^='
  | '|='
  | '+='
  | '-='
  | '*='
  | '/='
  | '%=';

export type AssignmentExpressionNode = BaseNode & {
  kind: 'AssignmentExpression';
  operator: AssignmentOperator;
  target: IdentifierExpressionNode | MemberExpressionNode;
  value: ExpressionNode;
};

export type CallExpressionNode = BaseNode & {
  arguments: ExpressionNode[];
  callee: ExpressionNode;
  kind: 'CallExpression';
};

export type ConditionalExpressionNode = BaseNode & {
  condition: ExpressionNode;
  elseExpression: ExpressionNode;
  kind: 'ConditionalExpression';
  thenExpression: ExpressionNode;
};

export type BinaryOperator =
  | '&&'
  | '&'
  | '!='
  | '%'
  | '*'
  | '+'
  | '-'
  | '/'
  | '<'
  | '<<'
  | '<='
  | '??'
  | '=='
  | '>'
  | '>='
  | '>>'
  | '^'
  | '|'
  | '||';

export type BinaryExpressionNode = BaseNode & {
  kind: 'BinaryExpression';
  left: ExpressionNode;
  operator: BinaryOperator;
  right: ExpressionNode;
};

export type UnaryOperator = '!' | '+' | '-' | '~';

export type UnaryExpressionNode = BaseNode & {
  expression: ExpressionNode;
  kind: 'UnaryExpression';
  operator: UnaryOperator;
};

export type BooleanLiteralNode = BaseNode & {
  kind: 'BooleanLiteral';
  value: boolean;
};

export type DoubleLiteralNode = BaseNode & {
  kind: 'DoubleLiteral';
  value: number;
};

export type GroupingExpressionNode = BaseNode & {
  expression: ExpressionNode;
  kind: 'GroupingExpression';
};

export type IdentifierExpressionNode = BaseNode & {
  kind: 'IdentifierExpression';
  name: string;
};

export type MemberExpressionNode = BaseNode & {
  kind: 'MemberExpression';
  object: ExpressionNode;
  property: IdentifierNode;
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

export type ThisExpressionNode = BaseNode & {
  kind: 'ThisExpression';
};

export type ExpressionNode =
  | AssignmentExpressionNode
  | BinaryExpressionNode
  | BooleanLiteralNode
  | CallExpressionNode
  | ConditionalExpressionNode
  | DoubleLiteralNode
  | GroupingExpressionNode
  | IdentifierExpressionNode
  | IntegerLiteralNode
  | MemberExpressionNode
  | NullLiteralNode
  | StringLiteralNode
  | ThisExpressionNode
  | UnaryExpressionNode;
