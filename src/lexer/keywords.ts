import { TokenType } from './token-type.js';

export const KEYWORDS: ReadonlyMap<string, TokenType> = new Map<string, TokenType>([
  ['null', TokenType.Null],
  ['val', TokenType.Val],
  ['var', TokenType.Var],
]);
