#!/usr/bin/env node

import { cac } from 'cac';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Checker } from './checker/checker.js';
import { CGenerator } from './codegen/c-generator.js';
import { CCompiler, getDefaultBinaryOutputPath, getDefaultCOutputPath } from './compiler/c-compiler.js';
import { Lexer } from './lexer/lexer.js';
import { Parser } from './parser/parser.js';

const cli = cac('pulse');

type CompileCommandOptions = {
  compiler?: string;
  emitC?: boolean | string;
  output?: string;
};

cli
  .command('compile <input>', 'Compile a Pulse source file')
  .option('--compiler <compiler>', 'Use a specific C compiler command')
  .option('--emit-c [path]', 'Write the generated C file to disk')
  .option('-o, --output <output>', 'Set the native executable output path')
  .action(async function compileCommand(input: string, options: CompileCommandOptions): Promise<void> {
    const sourceCode: string = await readFile(input, 'utf8');
    const lexer: Lexer = new Lexer(sourceCode);
    const tokens = lexer.tokenize();
    const parser: Parser = new Parser(tokens);
    const program = parser.parseProgram();
    const checker: Checker = new Checker();
    const cGenerator: CGenerator = new CGenerator();
    const cCompiler: CCompiler = new CCompiler();
    const binaryOutputPath: string = path.resolve(options.output ?? getDefaultBinaryOutputPath(input));

    checker.checkProgram(program);
    const generatedC: string = cGenerator.generateProgram(program);

    if (options.emitC !== undefined && options.emitC !== false) {
      const cOutputPath = path.resolve(
        typeof options.emitC === 'string' ? options.emitC : getDefaultCOutputPath(input)
      );

      await writeFile(cOutputPath, generatedC, 'utf8');
      console.log(`C source emitted to ${cOutputPath}`);
    }

    const compilerOptions =
      options.compiler === undefined
        ? {
            outputPath: binaryOutputPath,
          }
        : {
            compiler: options.compiler,
            outputPath: binaryOutputPath,
          };

    const compiler: string = await cCompiler.compile(generatedC, compilerOptions);

    console.log(`Compiled with ${compiler} to ${binaryOutputPath}`);
  });

cli.help();
cli.parse();
