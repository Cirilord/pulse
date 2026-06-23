import type { TokenLocation } from '../lexer/token.js';
import type {
  BlockStatementNode,
  FunctionDeclarationNode,
  FunctionParameterNode,
  IdentifierNode,
  ProgramNode,
  TypeNode,
} from '../parser/ast/index.js';

type CModuleCatalogEntry = {
  declarations: FunctionDeclarationNode[];
};

function createIdentifier(name: string, location: TokenLocation): IdentifierNode {
  return {
    kind: 'Identifier',
    location,
    name,
  };
}

function createNamedType(name: string, location: TokenLocation): TypeNode {
  return {
    kind: 'NamedType',
    location,
    name,
  };
}

function createParameter(
  name: string,
  typeName: string,
  location: TokenLocation,
  mutability: 'val' | 'var' = 'val'
): FunctionParameterNode {
  const parameterName: IdentifierNode = createIdentifier(name, location);
  const parameterType: TypeNode = createNamedType(typeName, location);

  return {
    kind: 'FunctionParameter',
    location,
    mutability,
    name: parameterName,
    type: parameterType,
  };
}

function createEmptyBlock(location: TokenLocation): BlockStatementNode {
  return {
    body: [],
    kind: 'BlockStatement',
    location,
  };
}

function createExternFunction(
  name: string,
  parameters: FunctionParameterNode[],
  returnTypeName: string,
  externSource: string,
  location: TokenLocation
): FunctionDeclarationNode {
  return {
    body: createEmptyBlock(location),
    externSource,
    isExtern: true,
    isExported: false,
    kind: 'FunctionDeclaration',
    location,
    name: createIdentifier(name, location),
    parameters,
    returnType: createNamedType(returnTypeName, location),
    throws: [],
  };
}

export function createCModuleCatalogEntry(source: string, location: TokenLocation): CModuleCatalogEntry | null {
  if (source === 'c:stdlib.h') {
    return {
      declarations: [
        createExternFunction('abs', [createParameter('value', 'int', location)], 'int', 'stdlib.h', location),
      ],
    };
  }

  return null;
}

export function createVirtualProgram(location: TokenLocation): ProgramNode {
  return {
    body: [],
    kind: 'Program',
    location,
  };
}
