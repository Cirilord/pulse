import type { TokenType } from './token-type.js';

export type TokenPosition = {
  column: number;
  line: number;
};

export type TokenLocation = {
  end: TokenPosition;
  start: TokenPosition;
};

export type Token = {
  lexeme: string;
  location: TokenLocation;
  type: TokenType;
};
