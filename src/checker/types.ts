export type PrimitiveTypeName = 'boolean' | 'byte' | 'char' | 'double' | 'float' | 'int' | 'string' | 'void';

export type ResolvedType = {
  kind: 'class' | 'primitive' | 'unknown';
  name: string;
  nullable: boolean;
};
