import { TokenType } from './token-type.js';

export const KEYWORDS: ReadonlyMap<string, TokenType> = new Map<string, TokenType>([
  ['false', TokenType.False],
  ['null', TokenType.Null],
  ['true', TokenType.True],
  ['val', TokenType.Val],
  ['var', TokenType.Var],
]);
