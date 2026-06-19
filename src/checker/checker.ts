/* eslint-disable @typescript-eslint/member-ordering */
import type { PrimitiveTypeName, ResolvedType } from './types.js';
import { type TokenLocation } from '../lexer/token.js';
import type {
  AssignmentExpressionNode,
  BinaryExpressionNode,
  BlockStatementNode,
  BreakStatementNode,
  CallExpressionNode,
  ClassDeclarationNode,
  ClassFieldDeclarationNode,
  ClassMethodDeclarationNode,
  ConditionalExpressionNode,
  ContinueStatementNode,
  DoWhileStatementNode,
  ExpressionNode,
  ExpressionStatementNode,
  FunctionDeclarationNode,
  FunctionParameterNode,
  ForStatementNode,
  IdentifierExpressionNode,
  IfStatementNode,
  MemberExpressionNode,
  NamedTypeNode,
  ProgramNode,
  ReturnStatementNode,
  StatementNode,
  TopLevelNode,
  TypeNode,
  UnaryExpressionNode,
  VariableDeclarationNode,
  WhileStatementNode,
} from '../parser/ast/index.js';

const PRIMITIVE_TYPES: ReadonlySet<string> = new Set<PrimitiveTypeName>([
  'boolean',
  'byte',
  'char',
  'double',
  'float',
  'int',
  'string',
  'void',
]);

type SymbolEntry = {
  mutability: 'val' | 'var';
  type: ResolvedType;
};

type FunctionEntry = {
  declaration: FunctionDeclarationNode;
  parameters: ResolvedParameter[];
  returnType: ResolvedType;
};

type ResolvedParameter = {
  mutability: 'val' | 'var';
  name: string;
  type: ResolvedType;
};

type ClassFieldEntry = {
  declaration: ClassFieldDeclarationNode;
  mutability: 'val' | 'var';
  type: ResolvedType;
};

type ClassMethodEntry = {
  declaration: ClassMethodDeclarationNode;
  mutatesThis: boolean;
  parameters: ResolvedParameter[];
  returnType: ResolvedType | null;
};

type ClassEntry = {
  constructorMethod: ClassMethodEntry | null;
  declaration: ClassDeclarationNode;
  fields: Map<string, ClassFieldEntry>;
  methods: Map<string, ClassMethodEntry>;
};

type ClassReference = {
  classEntry: ClassEntry;
  kind: 'class_reference';
};

type FieldAssignmentTarget = {
  classEntry: ClassEntry;
  fieldEntry: ClassFieldEntry;
  kind: 'field';
  target: MemberExpressionNode;
};

type VariableAssignmentTarget = {
  kind: 'variable';
  symbol: SymbolEntry;
  target: IdentifierExpressionNode;
};

type AssignmentTarget = FieldAssignmentTarget | VariableAssignmentTarget;

export class CheckerError extends Error {
  public readonly location: TokenLocation;

  public constructor(message: string, location: TokenLocation) {
    super(message);
    this.location = location;
    this.name = 'CheckerError';
  }
}

export class Checker {
  private readonly classes: Map<string, ClassEntry>;

  private currentClass: ClassEntry | null;

  private currentFunctionReturnType: ResolvedType | null;

  private currentMethod: ClassMethodEntry | null;

  private readonly functions: Map<string, FunctionEntry>;

  private loopDepth: number;

  private readonly scopes: Map<string, SymbolEntry>[];

  public constructor() {
    this.classes = new Map<string, ClassEntry>();
    this.currentClass = null;
    this.currentFunctionReturnType = null;
    this.currentMethod = null;
    this.functions = new Map<string, FunctionEntry>();
    this.loopDepth = 0;
    this.scopes = [];
  }

  public checkProgram(program: ProgramNode): void {
    this.classes.clear();
    this.currentClass = null;
    this.currentFunctionReturnType = null;
    this.currentMethod = null;
    this.functions.clear();
    this.loopDepth = 0;
    this.scopes.length = 0;
    this.pushScope();

    for (const topLevel of program.body) {
      if (topLevel.kind === 'ClassDeclaration') {
        this.declareClass(topLevel);
      }
    }

    for (const topLevel of program.body) {
      if (topLevel.kind === 'FunctionDeclaration') {
        this.declareFunction(topLevel);
      }
    }

    for (const topLevel of program.body) {
      this.checkTopLevel(topLevel);
    }

    this.popScope();
  }

  private assertExpressionAssignable(targetType: ResolvedType, expression: ExpressionNode): void {
    if (expression.kind === 'NullLiteral') {
      if (!targetType.nullable) {
        throw new CheckerError(`Type "${targetType.name}" does not allow null.`, expression.location);
      }

      return;
    }

    if (targetType.kind === 'primitive' && targetType.name === 'byte' && expression.kind === 'IntegerLiteral') {
      if (expression.value < 0 || expression.value > 255) {
        throw new CheckerError('Byte literals must be between 0 and 255.', expression.location);
      }

      return;
    }

    if (targetType.kind === 'primitive' && targetType.name === 'float' && expression.kind === 'DoubleLiteral') {
      return;
    }

    if (targetType.kind === 'primitive' && targetType.name === 'char' && expression.kind === 'StringLiteral') {
      if (expression.value.length !== 1) {
        throw new CheckerError('Char values must contain exactly one character.', expression.location);
      }

      return;
    }

    const expressionType: ResolvedType = this.resolveExpressionType(expression);

    if (!this.isSameType(targetType, expressionType)) {
      throw new CheckerError(
        `Cannot assign "${this.stringifyType(expressionType)}" to "${this.stringifyType(targetType)}".`,
        expression.location
      );
    }
  }

  private canAccessPrivateMember(ownerClassName: string): boolean {
    return this.currentClass?.declaration.name.name === ownerClassName;
  }

  private checkAssignmentExpression(expression: AssignmentExpressionNode): ResolvedType {
    const assignmentTarget: AssignmentTarget = this.resolveAssignmentTarget(expression.target);

    if (assignmentTarget.kind === 'variable') {
      if (assignmentTarget.symbol.mutability !== 'var') {
        throw new CheckerError(
          `Cannot reassign immutable value "${assignmentTarget.target.name}".`,
          assignmentTarget.target.location
        );
      }

      return this.checkVariableAssignmentExpression(expression, assignmentTarget.symbol.type);
    }

    const { fieldEntry, target } = assignmentTarget;

    if (
      fieldEntry.declaration.access === 'private' &&
      !this.canAccessPrivateMember(assignmentTarget.classEntry.declaration.name.name)
    ) {
      throw new CheckerError(
        `Cannot access private field "${fieldEntry.declaration.name.name}".`,
        target.property.location
      );
    }

    if (fieldEntry.mutability === 'val') {
      if (
        !this.isThisFieldTarget(target) ||
        this.currentMethod === null ||
        !this.currentMethod.declaration.isConstructor
      ) {
        throw new CheckerError(
          `Cannot reassign immutable field "${fieldEntry.declaration.name.name}".`,
          target.property.location
        );
      }
    } else if (!this.isMutableObjectExpression(target.object)) {
      throw new CheckerError('Cannot assign through an immutable object.', target.location);
    }

    return this.checkVariableAssignmentExpression(expression, fieldEntry.type);
  }

  private checkBlockStatement(statement: BlockStatementNode): void {
    this.pushScope();

    for (const innerStatement of statement.body) {
      this.checkStatement(innerStatement);
    }

    this.popScope();
  }

  private checkBreakStatement(statement: BreakStatementNode): void {
    if (this.loopDepth === 0) {
      throw new CheckerError('"break" can only be used inside a loop.', statement.location);
    }
  }

  private checkCallExpression(expression: CallExpressionNode): ResolvedType {
    if (expression.callee.kind === 'IdentifierExpression') {
      return this.checkIdentifierCallExpression(
        expression as CallExpressionNode & { callee: IdentifierExpressionNode }
      );
    }

    if (expression.callee.kind === 'MemberExpression') {
      return this.checkMemberCallExpression(expression as CallExpressionNode & { callee: MemberExpressionNode });
    }

    throw new CheckerError(
      'Only named functions, constructors, and methods can be called.',
      expression.callee.location
    );
  }

  private checkClassDeclaration(declaration: ClassDeclarationNode): void {
    const classEntry: ClassEntry = this.classes.get(declaration.name.name)!;
    const previousClass: ClassEntry | null = this.currentClass;

    this.currentClass = classEntry;

    try {
      if (classEntry.constructorMethod !== null) {
        this.checkClassMethodDeclaration(classEntry.constructorMethod);
      }

      for (const methodEntry of classEntry.methods.values()) {
        this.checkClassMethodDeclaration(methodEntry);
      }
    } finally {
      this.currentClass = previousClass;
    }
  }

  private checkClassMethodDeclaration(methodEntry: ClassMethodEntry): void {
    const declaration: ClassMethodDeclarationNode = methodEntry.declaration;
    const previousFunctionReturnType: ResolvedType | null = this.currentFunctionReturnType;
    const previousMethod: ClassMethodEntry | null = this.currentMethod;

    if (!declaration.isConstructor) {
      if (declaration.body.body.length === 0 || declaration.body.body.at(-1)?.kind !== 'ReturnStatement') {
        throw new CheckerError(
          `Method "${declaration.name.name}" must end with an explicit return statement.`,
          declaration.body.location
        );
      }
    }

    this.pushScope();
    this.currentFunctionReturnType = methodEntry.returnType;
    this.currentMethod = methodEntry;

    try {
      for (const parameter of methodEntry.parameters) {
        if (parameter.type.kind === 'primitive' && parameter.type.name === 'void') {
          throw new CheckerError('Method parameters cannot use the void type.', declaration.location);
        }

        this.peekScope().set(parameter.name, {
          mutability: parameter.mutability,
          type: parameter.type,
        });
      }

      for (const statement of declaration.body.body) {
        this.checkStatement(statement);
      }
    } finally {
      this.currentFunctionReturnType = previousFunctionReturnType;
      this.currentMethod = previousMethod;
      this.popScope();
    }
  }

  private checkConditionalExpression(expression: ConditionalExpressionNode): ResolvedType {
    const conditionType: ResolvedType = this.resolveExpressionType(expression.condition);

    if (conditionType.nullable || conditionType.kind !== 'primitive' || conditionType.name !== 'boolean') {
      throw new CheckerError(
        'Conditional expressions require a non-nullable boolean condition.',
        expression.condition.location
      );
    }

    if (expression.thenExpression.kind === 'NullLiteral' && expression.elseExpression.kind === 'NullLiteral') {
      throw new CheckerError('Conditional expressions cannot use null in both branches.', expression.location);
    }

    if (expression.thenExpression.kind === 'NullLiteral') {
      const elseType: ResolvedType = this.resolveExpressionType(expression.elseExpression);

      if (!elseType.nullable) {
        throw new CheckerError(
          'Null branches in conditional expressions require a nullable opposite branch.',
          expression.thenExpression.location
        );
      }

      return elseType;
    }

    if (expression.elseExpression.kind === 'NullLiteral') {
      const thenType: ResolvedType = this.resolveExpressionType(expression.thenExpression);

      if (!thenType.nullable) {
        throw new CheckerError(
          'Null branches in conditional expressions require a nullable opposite branch.',
          expression.elseExpression.location
        );
      }

      return thenType;
    }

    const thenType: ResolvedType = this.resolveExpressionType(expression.thenExpression);
    const elseType: ResolvedType = this.resolveExpressionType(expression.elseExpression);

    if (!this.isSameType(thenType, elseType)) {
      throw new CheckerError(
        `Conditional expression branches must have matching types, got "${this.stringifyType(thenType)}" and "${this.stringifyType(elseType)}".`,
        expression.location
      );
    }

    return thenType;
  }

  private checkContinueStatement(statement: ContinueStatementNode): void {
    if (this.loopDepth === 0) {
      throw new CheckerError('"continue" can only be used inside a loop.', statement.location);
    }
  }

  private checkDoWhileStatement(statement: DoWhileStatementNode): void {
    const conditionType: ResolvedType = this.resolveExpressionType(statement.condition);

    if (conditionType.nullable || conditionType.kind !== 'primitive' || conditionType.name !== 'boolean') {
      throw new CheckerError(
        'Do-while statements require a non-nullable boolean condition.',
        statement.condition.location
      );
    }

    this.loopDepth += 1;
    this.checkBlockStatement(statement.body);
    this.loopDepth -= 1;
  }

  private checkExpressionStatement(statement: ExpressionStatementNode): void {
    this.resolveExpressionType(statement.expression);
  }

  private checkFieldAccessExpression(expression: MemberExpressionNode): ResolvedType {
    const instanceInfo: ClassReference | ResolvedType = this.resolveMemberObject(expression.object);

    if ('kind' in instanceInfo && instanceInfo.kind === 'class_reference') {
      throw new CheckerError('Static method references cannot be used as values.', expression.location);
    }

    if (instanceInfo.kind !== 'class') {
      throw new CheckerError('Only class instances support member access.', expression.object.location);
    }

    const classEntry: ClassEntry = this.classes.get(instanceInfo.name)!;
    const fieldEntry: ClassFieldEntry | undefined = classEntry.fields.get(expression.property.name);

    if (fieldEntry === undefined) {
      if (classEntry.methods.has(expression.property.name)) {
        throw new CheckerError('Method references are not supported yet.', expression.location);
      }

      throw new CheckerError(
        `Class "${classEntry.declaration.name.name}" does not declare the field "${expression.property.name}".`,
        expression.property.location
      );
    }

    if (fieldEntry.declaration.access === 'private' && !this.canAccessPrivateMember(classEntry.declaration.name.name)) {
      throw new CheckerError(
        `Cannot access private field "${expression.property.name}".`,
        expression.property.location
      );
    }

    return fieldEntry.type;
  }

  private checkForStatement(statement: ForStatementNode): void {
    this.pushScope();

    try {
      if (statement.initializer.kind === 'VariableDeclaration') {
        this.checkVariableDeclaration(statement.initializer);
      } else {
        this.resolveExpressionType(statement.initializer);
      }

      const conditionType: ResolvedType = this.resolveExpressionType(statement.condition);

      if (conditionType.nullable || conditionType.kind !== 'primitive' || conditionType.name !== 'boolean') {
        throw new CheckerError(
          'For statements require a non-nullable boolean condition.',
          statement.condition.location
        );
      }

      this.resolveExpressionType(statement.update);
      this.loopDepth += 1;

      try {
        this.checkBlockStatement(statement.body);
      } finally {
        this.loopDepth -= 1;
      }
    } finally {
      this.popScope();
    }
  }

  private checkFunctionDeclaration(statement: FunctionDeclarationNode): void {
    const functionEntry: FunctionEntry = this.functions.get(statement.name.name)!;

    if (statement.body.body.length === 0 || statement.body.body.at(-1)?.kind !== 'ReturnStatement') {
      throw new CheckerError(
        `Function "${statement.name.name}" must end with an explicit return statement.`,
        statement.body.location
      );
    }

    this.pushScope();
    const previousFunctionReturnType: ResolvedType | null = this.currentFunctionReturnType;
    const previousMethod: ClassMethodEntry | null = this.currentMethod;
    const previousClass: ClassEntry | null = this.currentClass;
    this.currentFunctionReturnType = functionEntry.returnType;
    this.currentMethod = null;
    this.currentClass = null;

    try {
      for (const parameter of functionEntry.parameters) {
        if (parameter.type.kind === 'primitive' && parameter.type.name === 'void') {
          throw new CheckerError('Function parameters cannot use the void type.', statement.location);
        }

        this.peekScope().set(parameter.name, {
          mutability: parameter.mutability,
          type: parameter.type,
        });
      }

      for (const innerStatement of statement.body.body) {
        this.checkStatement(innerStatement);
      }
    } finally {
      this.currentFunctionReturnType = previousFunctionReturnType;
      this.currentMethod = previousMethod;
      this.currentClass = previousClass;
      this.popScope();
    }
  }

  private checkIdentifierCallExpression(
    expression: CallExpressionNode & { callee: IdentifierExpressionNode }
  ): ResolvedType {
    const calleeName: string = expression.callee.name;
    const functionEntry: FunctionEntry | undefined = this.functions.get(calleeName);

    if (functionEntry !== undefined) {
      this.assertArgumentsMatchParameters(
        expression.arguments,
        functionEntry.parameters,
        expression.location,
        `Function "${calleeName}"`
      );
      return functionEntry.returnType;
    }

    const classEntry: ClassEntry | undefined = this.classes.get(calleeName);

    if (classEntry === undefined) {
      throw new CheckerError(`Unknown function or class "${calleeName}".`, expression.callee.location);
    }

    if (classEntry.constructorMethod === null) {
      throw new CheckerError(`Class "${calleeName}" does not declare a constructor.`, expression.callee.location);
    }

    this.assertArgumentsMatchParameters(
      expression.arguments,
      classEntry.constructorMethod.parameters,
      expression.location,
      `Constructor "${calleeName}"`
    );

    return {
      kind: 'class',
      name: calleeName,
      nullable: false,
    };
  }

  private checkIfStatement(statement: IfStatementNode): void {
    const conditionType: ResolvedType = this.resolveExpressionType(statement.condition);

    if (conditionType.nullable || conditionType.kind !== 'primitive' || conditionType.name !== 'boolean') {
      throw new CheckerError('If statements require a non-nullable boolean condition.', statement.condition.location);
    }

    this.checkBlockStatement(statement.thenBranch);

    if (statement.elseBranch === null) {
      return;
    }

    if (statement.elseBranch.kind === 'BlockStatement') {
      this.checkBlockStatement(statement.elseBranch);
      return;
    }

    this.checkIfStatement(statement.elseBranch);
  }

  private checkMemberCallExpression(expression: CallExpressionNode & { callee: MemberExpressionNode }): ResolvedType {
    const memberExpression: MemberExpressionNode = expression.callee;
    const memberObject: ClassReference | ResolvedType = this.resolveMemberObject(memberExpression.object);

    if (memberObject.kind === 'class_reference') {
      const methodEntry: ClassMethodEntry | undefined = memberObject.classEntry.methods.get(
        memberExpression.property.name
      );

      if (methodEntry === undefined || !methodEntry.declaration.isStatic) {
        throw new CheckerError(
          `Class "${memberObject.classEntry.declaration.name.name}" does not declare the static method "${memberExpression.property.name}".`,
          memberExpression.property.location
        );
      }

      if (
        methodEntry.declaration.access === 'private' &&
        !this.canAccessPrivateMember(memberObject.classEntry.declaration.name.name)
      ) {
        throw new CheckerError(
          `Cannot access private method "${memberExpression.property.name}".`,
          memberExpression.property.location
        );
      }

      this.assertArgumentsMatchParameters(
        expression.arguments,
        methodEntry.parameters,
        expression.location,
        `Static method "${memberObject.classEntry.declaration.name.name}.${memberExpression.property.name}"`
      );

      return methodEntry.returnType!;
    }

    if (memberObject.kind !== 'class') {
      throw new CheckerError('Only class instances support method calls.', memberExpression.object.location);
    }

    const classEntry: ClassEntry = this.classes.get(memberObject.name)!;
    const methodEntry: ClassMethodEntry | undefined = classEntry.methods.get(memberExpression.property.name);

    if (methodEntry === undefined || methodEntry.declaration.isStatic) {
      throw new CheckerError(
        `Class "${classEntry.declaration.name.name}" does not declare the instance method "${memberExpression.property.name}".`,
        memberExpression.property.location
      );
    }

    if (
      methodEntry.declaration.access === 'private' &&
      !this.canAccessPrivateMember(classEntry.declaration.name.name)
    ) {
      throw new CheckerError(
        `Cannot access private method "${memberExpression.property.name}".`,
        memberExpression.property.location
      );
    }

    if (!this.isAddressableObjectExpression(memberExpression.object)) {
      throw new CheckerError(
        'Instance method calls require an addressable receiver expression.',
        memberExpression.object.location
      );
    }

    if (methodEntry.mutatesThis && !this.isMutableObjectExpression(memberExpression.object)) {
      throw new CheckerError(
        `Cannot call mutating method "${memberExpression.property.name}" on an immutable object.`,
        memberExpression.object.location
      );
    }

    this.assertArgumentsMatchParameters(
      expression.arguments,
      methodEntry.parameters,
      expression.location,
      `Method "${classEntry.declaration.name.name}.${memberExpression.property.name}"`
    );

    return methodEntry.returnType!;
  }

  private checkReturnStatement(statement: ReturnStatementNode): void {
    if (this.currentMethod?.declaration.isConstructor) {
      throw new CheckerError('Constructors cannot use return statements.', statement.location);
    }

    if (this.currentFunctionReturnType === null) {
      throw new CheckerError('"return" can only be used inside a function or method.', statement.location);
    }

    if (
      this.currentFunctionReturnType.kind === 'primitive' &&
      this.currentFunctionReturnType.name === 'void' &&
      !this.currentFunctionReturnType.nullable
    ) {
      if (statement.expression !== null) {
        throw new CheckerError('Void functions must use "return;" without a value.', statement.location);
      }

      return;
    }

    if (statement.expression === null) {
      throw new CheckerError('Non-void functions must return a value.', statement.location);
    }

    this.assertExpressionAssignable(this.currentFunctionReturnType, statement.expression);
  }

  private checkStatement(statement: StatementNode): void {
    switch (statement.kind) {
      case 'BlockStatement':
        this.checkBlockStatement(statement);
        return;
      case 'BreakStatement':
        this.checkBreakStatement(statement);
        return;
      case 'ContinueStatement':
        this.checkContinueStatement(statement);
        return;
      case 'DoWhileStatement':
        this.checkDoWhileStatement(statement);
        return;
      case 'ExpressionStatement':
        this.checkExpressionStatement(statement);
        return;
      case 'ForStatement':
        this.checkForStatement(statement);
        return;
      case 'IfStatement':
        this.checkIfStatement(statement);
        return;
      case 'ReturnStatement':
        this.checkReturnStatement(statement);
        return;
      case 'VariableDeclaration':
        this.checkVariableDeclaration(statement);
        return;
      case 'WhileStatement':
        this.checkWhileStatement(statement);
        return;
    }
  }

  private checkTopLevel(topLevel: TopLevelNode): void {
    if (topLevel.kind === 'ClassDeclaration') {
      this.checkClassDeclaration(topLevel);
      return;
    }

    if (topLevel.kind === 'FunctionDeclaration') {
      this.checkFunctionDeclaration(topLevel);
      return;
    }

    throw new CheckerError('Top-level statements are not allowed.', topLevel.location);
  }

  private checkVariableAssignmentExpression(
    expression: AssignmentExpressionNode,
    targetType: ResolvedType
  ): ResolvedType {
    if (expression.operator === '=') {
      this.assertExpressionAssignable(targetType, expression.value);
      return targetType;
    }

    if (expression.operator === '&&=' || expression.operator === '||=') {
      if (targetType.nullable || targetType.kind !== 'primitive' || targetType.name !== 'boolean') {
        throw new CheckerError(
          `Operator "${expression.operator}" can only be used with boolean variables.`,
          expression.location
        );
      }

      const valueType: ResolvedType = this.resolveExpressionType(expression.value);

      if (valueType.nullable || valueType.kind !== 'primitive' || valueType.name !== 'boolean') {
        throw new CheckerError(`Operator "${expression.operator}" requires boolean operands.`, expression.location);
      }

      return targetType;
    }

    if (expression.operator === '??=') {
      if (!targetType.nullable) {
        throw new CheckerError('Operator "??=" can only be used with nullable variables.', expression.location);
      }

      if (expression.value.kind === 'NullLiteral') {
        return targetType;
      }

      const valueType: ResolvedType = this.resolveExpressionType(expression.value);

      if (valueType.name !== targetType.name) {
        throw new CheckerError(
          `Operator "??=" cannot combine "${this.stringifyType(targetType)}" with "${this.stringifyType(valueType)}".`,
          expression.location
        );
      }

      return targetType;
    }

    if (targetType.kind !== 'primitive') {
      throw new CheckerError(`Operator "${expression.operator}" does not support class values.`, expression.location);
    }

    if (this.isBitwiseAssignmentOperator(expression.operator)) {
      if (!this.isBitwiseType(targetType.name as PrimitiveTypeName)) {
        throw new CheckerError(
          `Operator "${expression.operator}" can only be used with int and byte variables.`,
          expression.location
        );
      }

      const valueType: ResolvedType = this.resolveExpressionType(expression.value);

      if (
        valueType.nullable ||
        valueType.kind !== 'primitive' ||
        !this.isBitwiseType(valueType.name as PrimitiveTypeName)
      ) {
        throw new CheckerError(`Operator "${expression.operator}" requires int or byte operands.`, expression.location);
      }

      return targetType;
    }

    if (!this.isNumericType(targetType.name as PrimitiveTypeName)) {
      throw new CheckerError(
        `Operator "${expression.operator}" can only be used with numeric variables.`,
        expression.location
      );
    }

    if (expression.operator === '%=' && !this.isModuloCompatibleType(targetType.name as PrimitiveTypeName)) {
      throw new CheckerError('Operator "%=" can only be used with int and byte values.', expression.location);
    }

    this.assertExpressionAssignable(targetType, expression.value);

    return targetType;
  }

  private checkVariableDeclaration(declaration: VariableDeclarationNode): void {
    const currentScope: Map<string, SymbolEntry> = this.peekScope();

    if (currentScope.has(declaration.name.name)) {
      throw new CheckerError(`Variable "${declaration.name.name}" is already declared.`, declaration.name.location);
    }

    const declaredType: ResolvedType = this.resolveType(declaration.type);

    if (declaredType.kind === 'primitive' && declaredType.name === 'void') {
      throw new CheckerError('Variables cannot use the void type.', declaration.type.location);
    }

    this.assertExpressionAssignable(declaredType, declaration.initializer);

    currentScope.set(declaration.name.name, {
      mutability: declaration.mutability,
      type: declaredType,
    });
  }

  private checkWhileStatement(statement: WhileStatementNode): void {
    const conditionType: ResolvedType = this.resolveExpressionType(statement.condition);

    if (conditionType.nullable || conditionType.kind !== 'primitive' || conditionType.name !== 'boolean') {
      throw new CheckerError(
        'While statements require a non-nullable boolean condition.',
        statement.condition.location
      );
    }

    this.loopDepth += 1;
    this.checkBlockStatement(statement.body);
    this.loopDepth -= 1;
  }

  private declareClass(declaration: ClassDeclarationNode): void {
    if (this.classes.has(declaration.name.name) || PRIMITIVE_TYPES.has(declaration.name.name)) {
      throw new CheckerError(`Class "${declaration.name.name}" is already declared.`, declaration.name.location);
    }

    this.classes.set(declaration.name.name, {
      constructorMethod: null,
      declaration,
      fields: new Map<string, ClassFieldEntry>(),
      methods: new Map<string, ClassMethodEntry>(),
    });

    const fields: Map<string, ClassFieldEntry> = new Map<string, ClassFieldEntry>();
    const methods: Map<string, ClassMethodEntry> = new Map<string, ClassMethodEntry>();
    let constructorMethod: ClassMethodEntry | null = null;

    for (const member of declaration.members) {
      if (member.kind === 'ClassFieldDeclaration') {
        if (fields.has(member.name.name) || methods.has(member.name.name) || member.name.name === 'constructor') {
          throw new CheckerError(`Class member "${member.name.name}" is already declared.`, member.name.location);
        }

        const fieldType: ResolvedType = this.resolveType(member.type);

        if (fieldType.kind === 'primitive' && fieldType.name === 'void') {
          throw new CheckerError('Fields cannot use the void type.', member.type.location);
        }

        fields.set(member.name.name, {
          declaration: member,
          mutability: member.mutability,
          type: fieldType,
        });

        continue;
      }

      const methodEntry: ClassMethodEntry = {
        declaration: member,
        mutatesThis: this.methodMutatesThis(member),
        parameters: this.resolveParameters(member.parameters, 'Method'),
        returnType: member.returnType === null ? null : this.resolveType(member.returnType),
      };

      if (member.isConstructor) {
        if (member.isStatic) {
          throw new CheckerError('Constructors cannot be static.', member.location);
        }

        if (constructorMethod !== null) {
          throw new CheckerError(`Class "${declaration.name.name}" already declares a constructor.`, member.location);
        }

        constructorMethod = methodEntry;
        continue;
      }

      if (methods.has(member.name.name) || fields.has(member.name.name)) {
        throw new CheckerError(`Class member "${member.name.name}" is already declared.`, member.name.location);
      }

      if (
        methodEntry.returnType?.kind === 'primitive' &&
        methodEntry.returnType.name === 'void' &&
        methodEntry.returnType.nullable
      ) {
        throw new CheckerError('Methods cannot return "void?".', member.returnType!.location);
      }

      methods.set(member.name.name, methodEntry);
    }

    this.classes.set(declaration.name.name, {
      constructorMethod,
      declaration,
      fields,
      methods,
    });
  }

  private declareFunction(statement: FunctionDeclarationNode): void {
    if (this.functions.has(statement.name.name) || this.classes.has(statement.name.name)) {
      throw new CheckerError(`Function "${statement.name.name}" is already declared.`, statement.name.location);
    }

    const parameters: ResolvedParameter[] = this.resolveParameters(statement.parameters, 'Function');

    this.functions.set(statement.name.name, {
      declaration: statement,
      parameters,
      returnType: this.resolveType(statement.returnType),
    });
  }

  private getObjectRootExpression(expression: ExpressionNode): ExpressionNode {
    let currentExpression: ExpressionNode = expression;

    while (currentExpression.kind === 'MemberExpression') {
      currentExpression = currentExpression.object;
    }

    return currentExpression;
  }

  private isAddressableObjectExpression(expression: ExpressionNode): boolean {
    return (
      expression.kind === 'IdentifierExpression' ||
      expression.kind === 'MemberExpression' ||
      expression.kind === 'ThisExpression'
    );
  }

  private isBitwiseAssignmentOperator(operator: AssignmentExpressionNode['operator']): boolean {
    return operator === '&=' || operator === '<<=' || operator === '>>=' || operator === '^=' || operator === '|=';
  }

  private isBitwiseBinaryOperator(operator: BinaryExpressionNode['operator']): boolean {
    return operator === '&' || operator === '<<' || operator === '>>' || operator === '^' || operator === '|';
  }

  private isBitwiseType(typeName: PrimitiveTypeName): boolean {
    return typeName === 'byte' || typeName === 'int';
  }

  private isModuloCompatibleType(typeName: PrimitiveTypeName): boolean {
    return typeName === 'byte' || typeName === 'int';
  }

  private isMutableObjectExpression(expression: ExpressionNode): boolean {
    const rootExpression: ExpressionNode = this.getObjectRootExpression(expression);

    if (rootExpression.kind === 'ThisExpression') {
      return true;
    }

    if (rootExpression.kind !== 'IdentifierExpression') {
      return false;
    }

    const symbol: SymbolEntry = this.resolveIdentifier(rootExpression);

    return symbol.mutability === 'var';
  }

  private isNumericType(typeName: PrimitiveTypeName): boolean {
    return typeName === 'byte' || typeName === 'double' || typeName === 'float' || typeName === 'int';
  }

  private isSameType(leftType: ResolvedType, rightType: ResolvedType): boolean {
    return (
      leftType.kind === rightType.kind && leftType.name === rightType.name && leftType.nullable === rightType.nullable
    );
  }

  private isThisFieldTarget(target: MemberExpressionNode): boolean {
    return target.object.kind === 'ThisExpression';
  }

  private methodMutatesThis(method: ClassMethodDeclarationNode): boolean {
    const statementMutatesThis = (statement: StatementNode): boolean => {
      switch (statement.kind) {
        case 'BlockStatement':
          return statement.body.some(statementMutatesThis);
        case 'DoWhileStatement':
          return statement.body.body.some(statementMutatesThis);
        case 'ExpressionStatement':
          return expressionMutatesThis(statement.expression);
        case 'ForStatement':
          return (
            (statement.initializer.kind === 'VariableDeclaration' &&
              expressionMutatesThis(statement.initializer.initializer)) ||
            (statement.initializer.kind !== 'VariableDeclaration' && expressionMutatesThis(statement.initializer)) ||
            expressionMutatesThis(statement.condition) ||
            expressionMutatesThis(statement.update) ||
            statement.body.body.some(statementMutatesThis)
          );
        case 'IfStatement':
          return (
            expressionMutatesThis(statement.condition) ||
            statement.thenBranch.body.some(statementMutatesThis) ||
            (statement.elseBranch?.kind === 'BlockStatement' && statement.elseBranch.body.some(statementMutatesThis)) ||
            (statement.elseBranch?.kind === 'IfStatement' && statementMutatesThis(statement.elseBranch))
          );
        case 'ReturnStatement':
          return statement.expression !== null && expressionMutatesThis(statement.expression);
        case 'VariableDeclaration':
          return expressionMutatesThis(statement.initializer);
        case 'WhileStatement':
          return expressionMutatesThis(statement.condition) || statement.body.body.some(statementMutatesThis);
        case 'BreakStatement':
        case 'ContinueStatement':
          return false;
      }
    };

    const expressionMutatesThis = (expression: ExpressionNode): boolean => {
      switch (expression.kind) {
        case 'AssignmentExpression':
          return expression.target.kind === 'MemberExpression' && this.isThisFieldTarget(expression.target);
        case 'BinaryExpression':
          return expressionMutatesThis(expression.left) || expressionMutatesThis(expression.right);
        case 'CallExpression':
          return expression.arguments.some(expressionMutatesThis);
        case 'ConditionalExpression':
          return (
            expressionMutatesThis(expression.condition) ||
            expressionMutatesThis(expression.thenExpression) ||
            expressionMutatesThis(expression.elseExpression)
          );
        case 'GroupingExpression':
        case 'UnaryExpression':
          return expressionMutatesThis(expression.expression);
        case 'MemberExpression':
        case 'BooleanLiteral':
        case 'DoubleLiteral':
        case 'IdentifierExpression':
        case 'IntegerLiteral':
        case 'NullLiteral':
        case 'StringLiteral':
        case 'ThisExpression':
          return false;
      }
    };

    return method.body.body.some(statementMutatesThis);
  }

  private peekScope(): Map<string, SymbolEntry> {
    const scope: Map<string, SymbolEntry> | undefined = this.scopes.at(-1);

    if (scope === undefined) {
      throw new Error('Checker requires at least one active scope.');
    }

    return scope;
  }

  private popScope(): void {
    const scope: Map<string, SymbolEntry> | undefined = this.scopes.pop();

    if (scope === undefined) {
      throw new Error('Checker cannot pop an empty scope stack.');
    }
  }

  private pushScope(): void {
    this.scopes.push(new Map<string, SymbolEntry>());
  }

  private resolveAssignmentTarget(target: IdentifierExpressionNode | MemberExpressionNode): AssignmentTarget {
    if (target.kind === 'IdentifierExpression') {
      return {
        kind: 'variable',
        symbol: this.resolveIdentifier(target),
        target,
      };
    }

    const targetTypeOrClass: ClassReference | ResolvedType = this.resolveMemberObject(target.object);

    if ('kind' in targetTypeOrClass && targetTypeOrClass.kind === 'class_reference') {
      throw new CheckerError('Static members cannot be assigned.', target.location);
    }

    if (targetTypeOrClass.kind !== 'class') {
      throw new CheckerError('Only class instances support field assignment.', target.object.location);
    }

    const classEntry: ClassEntry = this.classes.get(targetTypeOrClass.name)!;
    const fieldEntry: ClassFieldEntry | undefined = classEntry.fields.get(target.property.name);

    if (fieldEntry === undefined) {
      throw new CheckerError(
        `Class "${classEntry.declaration.name.name}" does not declare the field "${target.property.name}".`,
        target.property.location
      );
    }

    return {
      classEntry,
      fieldEntry,
      kind: 'field',
      target,
    };
  }

  private resolveBinaryExpressionType(expression: BinaryExpressionNode): ResolvedType {
    if (expression.operator === '??') {
      return this.resolveNullCoalescingExpressionType(expression);
    }

    if (expression.operator === '==' || expression.operator === '!=') {
      return this.resolveEqualityExpressionType(expression);
    }

    const leftType: ResolvedType = this.resolveExpressionType(expression.left);
    const rightType: ResolvedType = this.resolveExpressionType(expression.right);

    if (leftType.nullable || rightType.nullable) {
      throw new CheckerError('Binary operators do not support nullable operands.', expression.location);
    }

    if (!this.isSameType(leftType, rightType)) {
      throw new CheckerError(
        `Cannot use operator "${expression.operator}" with "${this.stringifyType(leftType)}" and "${this.stringifyType(rightType)}".`,
        expression.location
      );
    }

    if (expression.operator === '&&' || expression.operator === '||') {
      if (leftType.kind !== 'primitive' || leftType.name !== 'boolean') {
        throw new CheckerError(
          `Operator "${expression.operator}" can only be used with boolean operands.`,
          expression.location
        );
      }

      return { kind: 'primitive', name: 'boolean', nullable: false };
    }

    if (leftType.kind !== 'primitive') {
      throw new CheckerError(`Operator "${expression.operator}" does not support class values.`, expression.location);
    }

    if (this.isBitwiseBinaryOperator(expression.operator)) {
      if (!this.isBitwiseType(leftType.name as PrimitiveTypeName)) {
        throw new CheckerError(
          `Operator "${expression.operator}" can only be used with int and byte operands.`,
          expression.location
        );
      }

      return leftType;
    }

    if (!this.isNumericType(leftType.name as PrimitiveTypeName)) {
      throw new CheckerError(
        `Operator "${expression.operator}" can only be used with numeric operands.`,
        expression.location
      );
    }

    if (expression.operator === '%' && !this.isModuloCompatibleType(leftType.name as PrimitiveTypeName)) {
      throw new CheckerError('Operator "%" can only be used with int and byte values.', expression.location);
    }

    if (
      expression.operator === '<' ||
      expression.operator === '<=' ||
      expression.operator === '>' ||
      expression.operator === '>='
    ) {
      return { kind: 'primitive', name: 'boolean', nullable: false };
    }

    return leftType;
  }

  private resolveEqualityExpressionType(expression: BinaryExpressionNode): ResolvedType {
    if (expression.left.kind === 'NullLiteral' && expression.right.kind === 'NullLiteral') {
      return { kind: 'primitive', name: 'boolean', nullable: false };
    }

    if (expression.left.kind === 'NullLiteral') {
      const rightType: ResolvedType = this.resolveExpressionType(expression.right);

      if (!rightType.nullable) {
        throw new CheckerError(`Cannot compare "${this.stringifyType(rightType)}" with "null".`, expression.location);
      }

      return { kind: 'primitive', name: 'boolean', nullable: false };
    }

    if (expression.right.kind === 'NullLiteral') {
      const leftType: ResolvedType = this.resolveExpressionType(expression.left);

      if (!leftType.nullable) {
        throw new CheckerError(`Cannot compare "${this.stringifyType(leftType)}" with "null".`, expression.location);
      }

      return { kind: 'primitive', name: 'boolean', nullable: false };
    }

    const leftType: ResolvedType = this.resolveExpressionType(expression.left);
    const rightType: ResolvedType = this.resolveExpressionType(expression.right);

    if (leftType.kind === 'class' || rightType.kind === 'class') {
      throw new CheckerError('Equality is not supported for class values yet.', expression.location);
    }

    if (!this.isSameType(leftType, rightType)) {
      throw new CheckerError(
        `Cannot use operator "${expression.operator}" with "${this.stringifyType(leftType)}" and "${this.stringifyType(rightType)}".`,
        expression.location
      );
    }

    return { kind: 'primitive', name: 'boolean', nullable: false };
  }

  private resolveExpressionType(expression: ExpressionNode): ResolvedType {
    switch (expression.kind) {
      case 'AssignmentExpression':
        return this.checkAssignmentExpression(expression);
      case 'BinaryExpression':
        return this.resolveBinaryExpressionType(expression);
      case 'BooleanLiteral':
        return { kind: 'primitive', name: 'boolean', nullable: false };
      case 'CallExpression':
        return this.checkCallExpression(expression);
      case 'ConditionalExpression':
        return this.checkConditionalExpression(expression);
      case 'DoubleLiteral':
        return { kind: 'primitive', name: 'double', nullable: false };
      case 'GroupingExpression':
        return this.resolveExpressionType(expression.expression);
      case 'IdentifierExpression':
        return this.resolveIdentifier(expression).type;
      case 'IntegerLiteral':
        return { kind: 'primitive', name: 'int', nullable: false };
      case 'MemberExpression':
        return this.checkFieldAccessExpression(expression);
      case 'NullLiteral':
        throw new CheckerError('Null must be handled before resolving an expression type.', expression.location);
      case 'StringLiteral':
        return { kind: 'primitive', name: 'string', nullable: false };
      case 'ThisExpression':
        return this.resolveThisExpressionType(expression.location);
      case 'UnaryExpression':
        return this.resolveUnaryExpressionType(expression);
    }
  }

  private resolveIdentifier(expression: IdentifierExpressionNode): SymbolEntry {
    for (let index = this.scopes.length - 1; index >= 0; index -= 1) {
      const symbol: SymbolEntry | undefined = this.scopes[index]?.get(expression.name);

      if (symbol !== undefined) {
        return symbol;
      }
    }

    throw new CheckerError(`Unknown variable "${expression.name}".`, expression.location);
  }

  private resolveMemberObject(expression: ExpressionNode): ClassReference | ResolvedType {
    if (expression.kind === 'IdentifierExpression') {
      for (let index = this.scopes.length - 1; index >= 0; index -= 1) {
        const symbol: SymbolEntry | undefined = this.scopes[index]?.get(expression.name);

        if (symbol !== undefined) {
          return symbol.type;
        }
      }

      const classEntry: ClassEntry | undefined = this.classes.get(expression.name);

      if (classEntry !== undefined) {
        return {
          classEntry,
          kind: 'class_reference',
        };
      }
    }

    return this.resolveExpressionType(expression);
  }

  private resolveNamedType(type: NamedTypeNode): ResolvedType {
    if (PRIMITIVE_TYPES.has(type.name)) {
      return {
        kind: 'primitive',
        name: type.name as PrimitiveTypeName,
        nullable: false,
      };
    }

    if (this.classes.has(type.name)) {
      return {
        kind: 'class',
        name: type.name,
        nullable: false,
      };
    }

    throw new CheckerError(`Unknown type "${type.name}".`, type.location);
  }

  private resolveNullCoalescingExpressionType(expression: BinaryExpressionNode): ResolvedType {
    if (expression.left.kind === 'NullLiteral') {
      if (expression.right.kind === 'NullLiteral') {
        throw new CheckerError('Operator "??" cannot coalesce null with null.', expression.location);
      }

      return this.resolveExpressionType(expression.right);
    }

    const leftType: ResolvedType = this.resolveExpressionType(expression.left);

    if (!leftType.nullable) {
      throw new CheckerError(
        'Operator "??" requires a nullable left operand or a null literal.',
        expression.left.location
      );
    }

    if (expression.right.kind === 'NullLiteral') {
      return leftType;
    }

    const rightType: ResolvedType = this.resolveExpressionType(expression.right);

    if (leftType.kind !== rightType.kind || leftType.name !== rightType.name) {
      throw new CheckerError(
        `Operator "??" cannot combine "${this.stringifyType(leftType)}" with "${this.stringifyType(rightType)}".`,
        expression.location
      );
    }

    return {
      kind: leftType.kind,
      name: leftType.name,
      nullable: rightType.nullable,
    };
  }

  private resolveParameters(
    parameters: FunctionParameterNode[],
    ownerLabel: 'Function' | 'Method'
  ): ResolvedParameter[] {
    const resolvedParameters: ResolvedParameter[] = parameters.map((parameter: FunctionParameterNode) => {
      const type: ResolvedType = this.resolveType(parameter.type);

      if (type.kind === 'primitive' && type.name === 'void') {
        throw new CheckerError(`${ownerLabel} parameters cannot use the void type.`, parameter.type.location);
      }

      return {
        mutability: parameter.mutability,
        name: parameter.name.name,
        type,
      };
    });
    const parameterNames: Set<string> = new Set<string>();

    for (const parameter of resolvedParameters) {
      if (parameterNames.has(parameter.name)) {
        const parameterNode: FunctionParameterNode | undefined = parameters.find(
          (currentParameter: FunctionParameterNode): boolean => currentParameter.name.name === parameter.name
        );

        throw new CheckerError(
          `Parameter "${parameter.name}" is already declared.`,
          parameterNode?.location ?? parameters[0]!.location
        );
      }

      parameterNames.add(parameter.name);
    }

    return resolvedParameters;
  }

  private resolveThisExpressionType(location: TokenLocation): ResolvedType {
    if (this.currentClass === null || this.currentMethod === null || this.currentMethod.declaration.isStatic) {
      throw new CheckerError('"this" can only be used inside instance methods and constructors.', location);
    }

    return {
      kind: 'class',
      name: this.currentClass.declaration.name.name,
      nullable: false,
    };
  }

  private resolveType(type: TypeNode): ResolvedType {
    if (type.kind === 'NamedType') {
      return this.resolveNamedType(type);
    }

    const resolvedInnerType: ResolvedType = this.resolveNamedType(type.type);

    if (resolvedInnerType.kind === 'primitive' && resolvedInnerType.name === 'void') {
      throw new CheckerError('Void types cannot be nullable.', type.location);
    }

    return {
      kind: resolvedInnerType.kind,
      name: resolvedInnerType.name,
      nullable: true,
    };
  }

  private resolveUnaryExpressionType(expression: UnaryExpressionNode): ResolvedType {
    const operandType: ResolvedType = this.resolveExpressionType(expression.expression);

    if (operandType.nullable) {
      throw new CheckerError(
        `Operator "${expression.operator}" does not support nullable operands.`,
        expression.location
      );
    }

    if (operandType.kind !== 'primitive') {
      throw new CheckerError(`Operator "${expression.operator}" does not support class values.`, expression.location);
    }

    switch (expression.operator) {
      case '!':
        if (operandType.name !== 'boolean') {
          throw new CheckerError('Operator "!" can only be used with boolean operands.', expression.location);
        }

        return { kind: 'primitive', name: 'boolean', nullable: false };
      case '+':
      case '-':
        if (!this.isNumericType(operandType.name as PrimitiveTypeName)) {
          throw new CheckerError(
            `Operator "${expression.operator}" can only be used with numeric operands.`,
            expression.location
          );
        }

        return operandType;
      case '~':
        if (!this.isBitwiseType(operandType.name as PrimitiveTypeName)) {
          throw new CheckerError('Operator "~" can only be used with int and byte operands.', expression.location);
        }

        return operandType;
    }
  }

  private assertArgumentsMatchParameters(
    argumentsList: ExpressionNode[],
    parameters: ResolvedParameter[],
    location: TokenLocation,
    label: string
  ): void {
    if (argumentsList.length !== parameters.length) {
      throw new CheckerError(`${label} expects ${parameters.length} arguments, got ${argumentsList.length}.`, location);
    }

    for (const [index, argument] of argumentsList.entries()) {
      const parameter: ResolvedParameter = parameters[index]!;
      this.assertExpressionAssignable(parameter.type, argument);
    }
  }

  private stringifyType(type: ResolvedType): string {
    return type.nullable ? `${type.name}?` : type.name;
  }
}
