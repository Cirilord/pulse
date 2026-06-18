export type PrimitiveTypeName = 'int' | 'string';

export type ResolvedType = {
  name: PrimitiveTypeName;
  nullable: boolean;
};
