export type PrimitiveTypeName = 'boolean' | 'byte' | 'char' | 'double' | 'float' | 'int' | 'string' | 'void';

export type ResolvedType = {
  name: PrimitiveTypeName;
  nullable: boolean;
};
