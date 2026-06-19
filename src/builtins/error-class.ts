import type { TokenLocation } from '../lexer/token.js';
import type {
  ClassDeclarationNode,
  ClassFieldDeclarationNode,
  ClassMethodDeclarationNode,
  FunctionParameterNode,
  IdentifierNode,
  NamedTypeNode,
} from '../parser/ast/index.js';

export const BUILTIN_ERROR_CLASS_NAME = 'Error';

const BUILTIN_LOCATION: TokenLocation = {
  end: {
    column: 1,
    line: 1,
  },
  start: {
    column: 1,
    line: 1,
  },
};

function createIdentifier(name: string): IdentifierNode {
  return {
    kind: 'Identifier',
    location: BUILTIN_LOCATION,
    name,
  };
}

function createNamedType(name: string): NamedTypeNode {
  return {
    kind: 'NamedType',
    location: BUILTIN_LOCATION,
    name,
  };
}

function createParameter(mutability: 'val' | 'var', name: string, typeName: string): FunctionParameterNode {
  return {
    kind: 'FunctionParameter',
    location: BUILTIN_LOCATION,
    mutability,
    name: createIdentifier(name),
    type: createNamedType(typeName),
  };
}

function createMessageField(): ClassFieldDeclarationNode {
  return {
    access: 'public',
    kind: 'ClassFieldDeclaration',
    location: BUILTIN_LOCATION,
    mutability: 'val',
    name: createIdentifier('message'),
    type: createNamedType('string'),
  };
}

function createConstructor(): ClassMethodDeclarationNode {
  return {
    access: 'public',
    body: {
      body: [
        {
          kind: 'ExpressionStatement',
          location: BUILTIN_LOCATION,
          expression: {
            kind: 'AssignmentExpression',
            location: BUILTIN_LOCATION,
            operator: '=',
            target: {
              kind: 'MemberExpression',
              location: BUILTIN_LOCATION,
              object: {
                kind: 'ThisExpression',
                location: BUILTIN_LOCATION,
              },
              property: createIdentifier('message'),
            },
            value: {
              kind: 'IdentifierExpression',
              location: BUILTIN_LOCATION,
              name: 'message',
            },
          },
        },
      ],
      kind: 'BlockStatement',
      location: BUILTIN_LOCATION,
    },
    isConstructor: true,
    isStatic: false,
    kind: 'ClassMethodDeclaration',
    location: BUILTIN_LOCATION,
    name: createIdentifier('constructor'),
    parameters: [createParameter('val', 'message', 'string')],
    returnType: null,
  };
}

export function createBuiltinErrorClassDeclaration(): ClassDeclarationNode {
  return {
    kind: 'ClassDeclaration',
    location: BUILTIN_LOCATION,
    members: [createMessageField(), createConstructor()],
    name: createIdentifier(BUILTIN_ERROR_CLASS_NAME),
  };
}
