export type PrimitiveTypeName = 'boolean' | 'byte' | 'char' | 'double' | 'float' | 'int' | 'string' | 'void';

export type ResolvedType = {
  kind: 'class' | 'primitive';
  name: string;
  nullable: boolean;
};
