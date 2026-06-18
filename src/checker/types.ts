export type PrimitiveTypeName = 'boolean' | 'byte' | 'double' | 'float' | 'int' | 'string';

export type ResolvedType = {
  name: PrimitiveTypeName;
  nullable: boolean;
};
