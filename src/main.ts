#!/usr/bin/env node

import { cac } from 'cac';
import { readFile } from 'node:fs/promises';

import { Checker } from './checker/checker.js';
import { Lexer } from './lexer/lexer.js';
import { Parser } from './parser/parser.js';

const cli = cac('pulse');

cli.command('compile <input>', 'Compile a Pulse source file').action(async function compileCommand(
  input: string
): Promise<void> {
  const sourceCode: string = await readFile(input, 'utf8');
  const lexer: Lexer = new Lexer(sourceCode);
  const tokens = lexer.tokenize();
  const parser: Parser = new Parser(tokens);
  const program = parser.parseProgram();
  const checker: Checker = new Checker();

  checker.checkProgram(program);

  console.log(program);
});

cli.help();
cli.parse();
