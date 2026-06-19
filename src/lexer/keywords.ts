import { TokenType } from './token-type.js';

export const KEYWORDS: ReadonlyMap<string, TokenType> = new Map<string, TokenType>([
  ['elif', TokenType.Elif],
  ['else', TokenType.Else],
  ['false', TokenType.False],
  ['if', TokenType.If],
  ['null', TokenType.Null],
  ['true', TokenType.True],
  ['val', TokenType.Val],
  ['var', TokenType.Var],
]);
