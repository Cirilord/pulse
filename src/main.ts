#!/usr/bin/env node

import { cac } from 'cac';
import { readFile } from 'node:fs/promises';

import { Lexer } from './lexer/lexer.js';

const cli = cac('pulse');

cli.command('compile <input>', 'Compile a Pulse source file').action(async function compileCommand(
  input: string
): Promise<void> {
  const sourceCode: string = await readFile(input, 'utf8');
  const lexer: Lexer = new Lexer(sourceCode);

  const tokens = lexer.tokenize();
  console.log(tokens);
});

cli.help();
cli.parse();
