import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Checker } from '../src/checker/checker.js';
import { CGenerator } from '../src/codegen/c-generator.js';
import { Lexer } from '../src/lexer/lexer.js';
import { Parser } from '../src/parser/parser.js';

async function collectPulseFiles(directoryPath: string): Promise<string[]> {
  const directoryEntries = await readdir(directoryPath, {
    withFileTypes: true,
  });

  const pulseFiles: string[] = [];

  for (const entry of directoryEntries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      pulseFiles.push(...(await collectPulseFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && path.extname(entry.name) === '.p') {
      pulseFiles.push(entryPath);
    }
  }

  return pulseFiles.sort();
}

async function generateCFile(inputPath: string): Promise<void> {
  const sourceCode: string = await readFile(inputPath, 'utf8');
  const lexer: Lexer = new Lexer(sourceCode);
  const parser: Parser = new Parser(lexer.tokenize());
  const checker: Checker = new Checker();
  const generator: CGenerator = new CGenerator();
  const program = parser.parseProgram();
  const outputPath: string = inputPath.replace(/\.p$/u, '.c');

  checker.checkProgram(program);

  await writeFile(outputPath, generator.generateProgram(program), 'utf8');
  console.log(`Generated ${outputPath}`);
}

async function main(): Promise<void> {
  const examplesDirectoryPath: string = path.resolve('examples');
  const pulseFiles: string[] = await collectPulseFiles(examplesDirectoryPath);

  for (const pulseFilePath of pulseFiles) {
    await generateCFile(pulseFilePath);
  }
}

await main();
