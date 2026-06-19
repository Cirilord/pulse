import type { FunctionDeclarationNode, ProgramNode, StatementNode } from '../src/parser/ast/index.js';

export function getMainFunction(program: ProgramNode): FunctionDeclarationNode {
  const mainFunction: FunctionDeclarationNode | undefined = program.body.find(
    (topLevel): topLevel is FunctionDeclarationNode =>
      topLevel.kind === 'FunctionDeclaration' && topLevel.name.name === 'main'
  );

  if (mainFunction === undefined) {
    throw new Error('Expected the example program to declare "fn main(): int".');
  }

  return mainFunction;
}

export function getMainStatements(program: ProgramNode): StatementNode[] {
  return getMainFunction(program).body.body;
}

export function wrapInMain(statements: string): string {
  return `fn main(): int {\n${statements}\n\n  return 0;\n}`;
}
