import type { TokenLocation } from '../../lexer/token.js';

export type BaseNode = {
  kind: string;
  location: TokenLocation;
};
