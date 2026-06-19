import { TokenType } from './token-type.js';

export const KEYWORDS: ReadonlyMap<string, TokenType> = new Map<string, TokenType>([
  ['break', TokenType.Break],
  ['continue', TokenType.Continue],
  ['do', TokenType.Do],
  ['elif', TokenType.Elif],
  ['else', TokenType.Else],
  ['false', TokenType.False],
  ['fn', TokenType.Fn],
  ['for', TokenType.For],
  ['if', TokenType.If],
  ['null', TokenType.Null],
  ['return', TokenType.Return],
  ['true', TokenType.True],
  ['val', TokenType.Val],
  ['var', TokenType.Var],
  ['while', TokenType.While],
]);
