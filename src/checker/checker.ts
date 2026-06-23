/* eslint-disable @typescript-eslint/member-ordering */
import type { PrimitiveTypeName, ResolvedType } from './types.js';
import { createBuiltinErrorClassDeclaration } from '../builtins/error-class.js';
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
  DeferStatementNode,
  DoWhileStatementNode,
  ExpressionNode,
  ExpressionStatementNode,
  FunctionDeclarationNode,
  FunctionParameterNode,
  ForStatementNode,
  IdentifierExpressionNode,
  IfStatementNode,
  MemberExpressionNode,
  MultiVariableDeclarationNode,
  NamedTypeNode,
  ProgramNode,
  ReturnStatementNode,
  StatementNode,
  TopLevelNode,
  TypeNode,
  UnaryExpressionNode,
  VariableBindingNode,
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
  declaredType: ResolvedType;
  mutability: 'val' | 'var';
  type: ResolvedType;
};

type FunctionEntry = {
  declaration: FunctionDeclarationNode;
  parameters: ResolvedParameter[];
  returnType: ResolvedType;
  throws: ResolvedType[];
};

type ResolvedParameter = {
  mutability: 'val' | 'var';
  name: string;
  type: ResolvedType;
};

type ClassFieldEntry = {
  declaration: ClassFieldDeclarationNode;
  mutability: 'val' | 'var';
  ownerClassName: string;
  type: ResolvedType;
};

type ClassMethodEntry = {
  declaration: ClassMethodDeclarationNode;
  mutatesThis: boolean;
  ownerClassName: string;
  parameters: ResolvedParameter[];
  returnType: ResolvedType | null;
  throws: ResolvedType[];
};

type ClassEntry = {
  baseClassName: string | null;
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

type ThrowsCallInfo = {
  returnType: ResolvedType;
  throws: ResolvedType[];
};

type ConditionNarrowing = {
  name: string;
  type: ResolvedType;
};

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

  private currentFunctionThrows: ResolvedType[];

  private currentMethod: ClassMethodEntry | null;

  private readonly functions: Map<string, FunctionEntry>;

  private loopDepth: number;

  private readonly scopes: Map<string, SymbolEntry>[];

  public constructor() {
    this.classes = new Map<string, ClassEntry>();
    this.currentClass = null;
    this.currentFunctionReturnType = null;
    this.currentFunctionThrows = [];
    this.currentMethod = null;
    this.functions = new Map<string, FunctionEntry>();
    this.loopDepth = 0;
    this.scopes = [];
  }

  public checkProgram(program: ProgramNode): void {
    this.classes.clear();
    this.currentClass = null;
    this.currentFunctionReturnType = null;
    this.currentFunctionThrows = [];
    this.currentMethod = null;
    this.functions.clear();
    this.loopDepth = 0;
    this.scopes.length = 0;
    this.pushScope();
    this.declareBuiltinClasses();

    for (const topLevel of program.body) {
      if (topLevel.kind === 'ClassDeclaration') {
        this.predeclareClass(topLevel);
      }
    }

    for (const topLevel of program.body) {
      if (topLevel.kind === 'ClassDeclaration') {
        this.declareClass(topLevel);
      }
    }

    for (const topLevel of program.body) {
      if (topLevel.kind === 'VariableDeclaration') {
        this.predeclareTopLevelVariable(topLevel);
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

  private declareBuiltinClasses(): void {
    const errorClassDeclaration: ClassDeclarationNode = createBuiltinErrorClassDeclaration();
    this.predeclareClass(errorClassDeclaration);
    this.declareClass(errorClassDeclaration);
  }

  private predeclareClass(declaration: ClassDeclarationNode): void {
    if (this.classes.has(declaration.name.name) || PRIMITIVE_TYPES.has(declaration.name.name)) {
      throw new CheckerError(`Class "${declaration.name.name}" is already declared.`, declaration.name.location);
    }

    this.classes.set(declaration.name.name, {
      baseClassName: declaration.baseName?.name ?? null,
      constructorMethod: null,
      declaration,
      fields: new Map<string, ClassFieldEntry>(),
      methods: new Map<string, ClassMethodEntry>(),
    });
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

    if (
      targetType.nullable &&
      targetType.kind === expressionType.kind &&
      targetType.name === expressionType.name &&
      !expressionType.nullable
    ) {
      return;
    }

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

  private classChainContains(classEntry: ClassEntry, className: string): boolean {
    let currentBaseClassName: string | null = classEntry.baseClassName;

    while (currentBaseClassName !== null) {
      if (currentBaseClassName === className) {
        return true;
      }

      currentBaseClassName = this.classes.get(currentBaseClassName)?.baseClassName ?? null;
    }

    return false;
  }

  private findFieldEntryInHierarchy(
    classEntry: ClassEntry,
    fieldName: string
  ): { ownerClassEntry: ClassEntry; fieldEntry: ClassFieldEntry } | null {
    let currentClassEntry: ClassEntry | undefined = classEntry;

    while (currentClassEntry !== undefined) {
      const fieldEntry: ClassFieldEntry | undefined = currentClassEntry.fields.get(fieldName);

      if (fieldEntry !== undefined) {
        return {
          fieldEntry,
          ownerClassEntry: currentClassEntry,
        };
      }

      currentClassEntry =
        currentClassEntry.baseClassName === null ? undefined : this.classes.get(currentClassEntry.baseClassName);
    }

    return null;
  }

  private findMethodEntryInHierarchy(
    classEntry: ClassEntry,
    methodName: string
  ): { methodEntry: ClassMethodEntry; ownerClassEntry: ClassEntry } | null {
    let currentClassEntry: ClassEntry | undefined = classEntry;

    while (currentClassEntry !== undefined) {
      const methodEntry: ClassMethodEntry | undefined = currentClassEntry.methods.get(methodName);

      if (methodEntry !== undefined) {
        return {
          methodEntry,
          ownerClassEntry: currentClassEntry,
        };
      }

      currentClassEntry =
        currentClassEntry.baseClassName === null ? undefined : this.classes.get(currentClassEntry.baseClassName);
    }

    return null;
  }

  private findMethodEntryInBaseHierarchy(
    classEntry: ClassEntry,
    methodName: string
  ): { methodEntry: ClassMethodEntry; ownerClassEntry: ClassEntry } | null {
    if (classEntry.baseClassName === null) {
      return null;
    }

    const baseClassEntry: ClassEntry | undefined = this.classes.get(classEntry.baseClassName);

    if (baseClassEntry === undefined) {
      return null;
    }

    return this.findMethodEntryInHierarchy(baseClassEntry, methodName);
  }

  private findFieldEntryInBaseHierarchy(
    classEntry: ClassEntry,
    fieldName: string
  ): { ownerClassEntry: ClassEntry; fieldEntry: ClassFieldEntry } | null {
    if (classEntry.baseClassName === null) {
      return null;
    }

    const baseClassEntry: ClassEntry | undefined = this.classes.get(classEntry.baseClassName);

    if (baseClassEntry === undefined) {
      return null;
    }

    return this.findFieldEntryInHierarchy(baseClassEntry, fieldName);
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

      return this.checkVariableAssignmentExpression(expression, assignmentTarget.symbol.declaredType);
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

  private checkBlockStatement(statement: BlockStatementNode, narrowings: ConditionNarrowing[] = []): void {
    this.pushScope();

    for (const narrowing of narrowings) {
      const symbol: SymbolEntry | undefined = this.tryResolveIdentifier(narrowing.name);

      if (symbol === undefined) {
        continue;
      }

      this.peekScope().set(narrowing.name, {
        declaredType: symbol.declaredType,
        mutability: symbol.mutability,
        type: narrowing.type,
      });
    }

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
    if (expression.callee.kind === 'SuperExpression') {
      return this.checkSuperConstructorCall(expression);
    }

    if (expression.callee.kind === 'IdentifierExpression') {
      if (expression.callee.name === 'isInstance') {
        return this.checkIsInstanceCall(expression);
      }

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

  private checkSuperConstructorCall(expression: CallExpressionNode & { callee: ExpressionNode }): ResolvedType {
    if (this.currentMethod === null || !this.currentMethod.declaration.isConstructor || this.currentClass === null) {
      throw new CheckerError('"super(...)" can only be used inside derived class constructors.', expression.location);
    }

    if (this.currentClass.baseClassName === null) {
      throw new CheckerError('"super(...)" can only be used inside derived class constructors.', expression.location);
    }

    const baseClassEntry: ClassEntry | undefined = this.classes.get(this.currentClass.baseClassName);

    if (baseClassEntry === undefined || baseClassEntry.constructorMethod === null) {
      throw new CheckerError(
        `Base class "${this.currentClass.baseClassName}" does not declare a constructor.`,
        expression.location
      );
    }

    this.assertArgumentsMatchParameters(
      expression.arguments,
      baseClassEntry.constructorMethod.parameters,
      expression.location,
      `Constructor "${baseClassEntry.declaration.name.name}"`
    );

    return {
      kind: 'class',
      name: baseClassEntry.declaration.name.name,
      nullable: false,
    };
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
    const previousFunctionThrows: ResolvedType[] = this.currentFunctionThrows;
    const previousMethod: ClassMethodEntry | null = this.currentMethod;

    if (!declaration.isConstructor) {
      if (!this.statementListAlwaysReturns(declaration.body.body)) {
        throw new CheckerError(
          `Method "${declaration.name.name}" must end with an explicit return statement.`,
          declaration.body.location
        );
      }
    }

    if (declaration.isConstructor) {
      this.validateConstructorSuperUsage(declaration);
    }

    this.pushScope();
    this.currentFunctionReturnType = methodEntry.returnType;
    this.currentFunctionThrows = methodEntry.throws;
    this.currentMethod = methodEntry;

    try {
      for (const parameter of methodEntry.parameters) {
        if (parameter.type.kind === 'primitive' && parameter.type.name === 'void') {
          throw new CheckerError('Method parameters cannot use the void type.', declaration.location);
        }

        this.peekScope().set(parameter.name, {
          declaredType: parameter.type,
          mutability: parameter.mutability,
          type: parameter.type,
        });
      }

      for (const statement of declaration.body.body) {
        this.checkStatement(statement);
      }
    } finally {
      this.currentFunctionReturnType = previousFunctionReturnType;
      this.currentFunctionThrows = previousFunctionThrows;
      this.currentMethod = previousMethod;
      this.popScope();
    }
  }

  private validateConstructorSuperUsage(declaration: ClassMethodDeclarationNode): void {
    if (this.currentClass === null || this.currentClass.baseClassName === null) {
      return;
    }

    const baseClassEntry: ClassEntry | undefined = this.classes.get(this.currentClass.baseClassName);
    const superCalls: CallExpressionNode[] = declaration.body.body.flatMap(
      (statement: StatementNode): CallExpressionNode[] => this.collectSuperConstructorCallsFromStatement(statement)
    );

    if (superCalls.length > 1) {
      throw new CheckerError('"super(...)" can only be called once in a derived constructor.', superCalls[1]!.location);
    }

    if (superCalls.length === 1) {
      const firstStatement: StatementNode | undefined = declaration.body.body[0];
      const isFirstStatementSuperCall: boolean =
        firstStatement?.kind === 'ExpressionStatement' &&
        firstStatement.expression.kind === 'CallExpression' &&
        firstStatement.expression.callee.kind === 'SuperExpression';

      if (!isFirstStatementSuperCall) {
        throw new CheckerError(
          '"super(...)" must be the first statement in a derived constructor.',
          superCalls[0]!.location
        );
      }
    }

    if (superCalls.length === 0 && baseClassEntry?.constructorMethod !== null) {
      throw new CheckerError(
        `Constructor "${this.currentClass.declaration.name.name}" must call super(...).`,
        declaration.location
      );
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

  private checkDeferStatement(statement: DeferStatementNode): void {
    if (statement.expression.kind !== 'CallExpression') {
      throw new CheckerError('Defer statements require a call expression.', statement.expression.location);
    }

    this.resolveExpressionType(statement.expression);
  }

  private checkExpressionStatement(statement: ExpressionStatementNode): void {
    this.resolveExpressionType(statement.expression);
  }

  private checkMultiVariableDeclaration(declaration: MultiVariableDeclarationNode): void {
    const currentScope: Map<string, SymbolEntry> = this.peekScope();

    for (const binding of declaration.bindings) {
      if (currentScope.has(binding.name.name)) {
        throw new CheckerError(`Variable "${binding.name.name}" is already declared.`, binding.name.location);
      }
    }

    if (declaration.initializer.kind !== 'CallExpression') {
      throw new CheckerError(
        'Multiple variable declarations require a call to a throwing function or method.',
        declaration.initializer.location
      );
    }

    const throwsInfo: ThrowsCallInfo = this.resolveThrowsCallInfo(declaration.initializer);

    if (throwsInfo.throws.length === 0) {
      throw new CheckerError(
        'Multiple variable declarations require a call to a function or method with "throws".',
        declaration.initializer.location
      );
    }

    if (
      throwsInfo.returnType.kind === 'primitive' &&
      throwsInfo.returnType.name === 'void' &&
      !throwsInfo.returnType.nullable
    ) {
      throw new CheckerError(
        'Void throwing calls return only an error and cannot be used in a multiple variable declaration.',
        declaration.initializer.location
      );
    }

    if (declaration.bindings.length !== 2) {
      throw new CheckerError(
        'Throwing calls with a return value require exactly two variable bindings.',
        declaration.location
      );
    }

    const valueBinding: VariableBindingNode = declaration.bindings[0]!;
    const errorBinding: VariableBindingNode = declaration.bindings[1]!;
    const valueType: ResolvedType = this.resolveType(valueBinding.type);

    if (valueType.kind === 'primitive' && valueType.name === 'void') {
      throw new CheckerError('Variables cannot use the void type.', valueBinding.type.location);
    }

    if (!this.isSameType(valueType, throwsInfo.returnType)) {
      throw new CheckerError(
        `Cannot assign "${this.stringifyType(throwsInfo.returnType)}" to "${this.stringifyType(valueType)}".`,
        valueBinding.location
      );
    }

    this.assertErrorBindingMatchesThrows(errorBinding.type, throwsInfo.throws);
    const errorType: ResolvedType = this.resolveType(errorBinding.type);

    currentScope.set(valueBinding.name.name, {
      declaredType: valueType,
      mutability: valueBinding.mutability,
      type: valueType,
    });
    currentScope.set(errorBinding.name.name, {
      declaredType: errorType,
      mutability: errorBinding.mutability,
      type: errorType,
    });
  }

  private checkFieldAccessExpression(expression: MemberExpressionNode): ResolvedType {
    const instanceInfo: ClassReference | ResolvedType = this.resolveMemberObject(expression.object);

    if ('kind' in instanceInfo && instanceInfo.kind === 'class_reference') {
      if (expression.property.name === 'name') {
        return {
          kind: 'primitive',
          name: 'string',
          nullable: false,
        };
      }

      if (expression.property.name === 'toString') {
        throw new CheckerError('Static method references are not supported yet.', expression.location);
      }

      throw new CheckerError(
        `Class "${instanceInfo.classEntry.declaration.name.name}" does not declare the static field "${expression.property.name}".`,
        expression.property.location
      );
    }

    if (instanceInfo.kind !== 'class') {
      throw new CheckerError('Only class instances support member access.', expression.object.location);
    }

    const classEntry: ClassEntry = this.classes.get(instanceInfo.name)!;
    const fieldLookup = this.findFieldEntryInHierarchy(classEntry, expression.property.name);

    if (fieldLookup === null) {
      if (this.findMethodEntryInHierarchy(classEntry, expression.property.name) !== null) {
        throw new CheckerError('Method references are not supported yet.', expression.location);
      }

      throw new CheckerError(
        `Class "${classEntry.declaration.name.name}" does not declare the field "${expression.property.name}".`,
        expression.property.location
      );
    }

    if (
      fieldLookup.fieldEntry.declaration.access === 'private' &&
      !this.canAccessPrivateMember(fieldLookup.ownerClassEntry.declaration.name.name)
    ) {
      throw new CheckerError(
        `Cannot access private field "${expression.property.name}".`,
        expression.property.location
      );
    }

    return fieldLookup.fieldEntry.type;
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

    if (!statement.isExtern && !this.statementListAlwaysReturns(statement.body.body)) {
      throw new CheckerError(
        `Function "${statement.name.name}" must end with an explicit return statement.`,
        statement.body.location
      );
    }

    this.pushScope();
    const previousFunctionReturnType: ResolvedType | null = this.currentFunctionReturnType;
    const previousFunctionThrows: ResolvedType[] = this.currentFunctionThrows;
    const previousMethod: ClassMethodEntry | null = this.currentMethod;
    const previousClass: ClassEntry | null = this.currentClass;
    this.currentFunctionReturnType = functionEntry.returnType;
    this.currentFunctionThrows = functionEntry.throws;
    this.currentMethod = null;
    this.currentClass = null;

    try {
      for (const parameter of functionEntry.parameters) {
        if (parameter.type.kind === 'primitive' && parameter.type.name === 'void') {
          throw new CheckerError('Function parameters cannot use the void type.', statement.location);
        }

        this.peekScope().set(parameter.name, {
          declaredType: parameter.type,
          mutability: parameter.mutability,
          type: parameter.type,
        });
      }

      if (!statement.isExtern) {
        for (const innerStatement of statement.body.body) {
          this.checkStatement(innerStatement);
        }
      }
    } finally {
      this.currentFunctionReturnType = previousFunctionReturnType;
      this.currentFunctionThrows = previousFunctionThrows;
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

      if (functionEntry.throws.length > 0) {
        throw new CheckerError(
          `Function "${calleeName}" must be captured through its error return values.`,
          expression.location
        );
      }

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

    this.checkBlockStatement(statement.thenBranch, this.resolveConditionNarrowings(statement.condition));

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
      if (memberExpression.property.name === 'toString') {
        if (expression.arguments.length > 0) {
          throw new CheckerError(
            `Static method "${memberObject.classEntry.declaration.name.name}.toString" expects 0 arguments but received ${expression.arguments.length}.`,
            expression.location
          );
        }

        return {
          kind: 'primitive',
          name: 'string',
          nullable: false,
        };
      }

      const methodLookup = this.findMethodEntryInHierarchy(memberObject.classEntry, memberExpression.property.name);

      if (methodLookup === null || !methodLookup.methodEntry.declaration.isStatic) {
        throw new CheckerError(
          `Class "${memberObject.classEntry.declaration.name.name}" does not declare the static method "${memberExpression.property.name}".`,
          memberExpression.property.location
        );
      }

      if (
        methodLookup.methodEntry.declaration.access === 'private' &&
        !this.canAccessPrivateMember(methodLookup.ownerClassEntry.declaration.name.name)
      ) {
        throw new CheckerError(
          `Cannot access private method "${memberExpression.property.name}".`,
          memberExpression.property.location
        );
      }

      this.assertArgumentsMatchParameters(
        expression.arguments,
        methodLookup.methodEntry.parameters,
        expression.location,
        `Static method "${memberObject.classEntry.declaration.name.name}.${memberExpression.property.name}"`
      );

      if (methodLookup.methodEntry.throws.length > 0) {
        throw new CheckerError(
          `Static method "${memberObject.classEntry.declaration.name.name}.${memberExpression.property.name}" must be captured through its error return values.`,
          expression.location
        );
      }

      return methodLookup.methodEntry.returnType!;
    }

    if (memberObject.kind !== 'class') {
      throw new CheckerError('Only class instances support method calls.', memberExpression.object.location);
    }

    const classEntry: ClassEntry = this.classes.get(memberObject.name)!;
    const methodLookup = this.findMethodEntryInHierarchy(classEntry, memberExpression.property.name);

    if (methodLookup === null || methodLookup.methodEntry.declaration.isStatic) {
      throw new CheckerError(
        `Class "${classEntry.declaration.name.name}" does not declare the instance method "${memberExpression.property.name}".`,
        memberExpression.property.location
      );
    }

    if (
      methodLookup.methodEntry.declaration.access === 'private' &&
      !this.canAccessPrivateMember(methodLookup.ownerClassEntry.declaration.name.name)
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

    if (methodLookup.methodEntry.mutatesThis && !this.isMutableObjectExpression(memberExpression.object)) {
      throw new CheckerError(
        `Cannot call mutating method "${memberExpression.property.name}" on an immutable object.`,
        memberExpression.object.location
      );
    }

    this.assertArgumentsMatchParameters(
      expression.arguments,
      methodLookup.methodEntry.parameters,
      expression.location,
      `Method "${classEntry.declaration.name.name}.${memberExpression.property.name}"`
    );

    if (methodLookup.methodEntry.throws.length > 0) {
      throw new CheckerError(
        `Method "${classEntry.declaration.name.name}.${memberExpression.property.name}" must be captured through its error return values.`,
        expression.location
      );
    }

    return methodLookup.methodEntry.returnType!;
  }

  private checkIsInstanceCall(expression: CallExpressionNode): ResolvedType {
    if (expression.arguments.length !== 2) {
      throw new CheckerError('Function "isInstance" expects 2 arguments.', expression.location);
    }

    const instanceArgument: ExpressionNode = expression.arguments[0]!;
    const instanceType: ResolvedType = this.resolveExpressionType(instanceArgument);

    if (instanceType.kind !== 'class' && instanceType.kind !== 'unknown') {
      throw new CheckerError(
        'Function "isInstance" expects a class instance or unknown value as the first argument.',
        instanceArgument.location
      );
    }

    const targetArgument: ExpressionNode = expression.arguments[1]!;
    const targetObject: ClassReference | ResolvedType = this.resolveMemberObject(targetArgument);

    if (!('kind' in targetObject) || targetObject.kind !== 'class_reference') {
      throw new CheckerError(
        'Function "isInstance" expects a class reference as the second argument.',
        targetArgument.location
      );
    }

    return {
      kind: 'primitive',
      name: 'boolean',
      nullable: false,
    };
  }

  private resolveThrowsCallInfo(expression: CallExpressionNode): ThrowsCallInfo {
    if (expression.callee.kind === 'SuperExpression') {
      return {
        returnType: this.checkSuperConstructorCall(expression),
        throws: [],
      };
    }

    if (expression.callee.kind === 'IdentifierExpression') {
      if (expression.callee.name === 'isInstance') {
        return {
          returnType: {
            kind: 'primitive',
            name: 'boolean',
            nullable: false,
          },
          throws: [],
        };
      }

      const functionEntry: FunctionEntry | undefined = this.functions.get(expression.callee.name);

      if (functionEntry !== undefined) {
        return {
          returnType: functionEntry.returnType,
          throws: functionEntry.throws,
        };
      }

      if (this.classes.has(expression.callee.name)) {
        return {
          returnType: {
            kind: 'class',
            name: expression.callee.name,
            nullable: false,
          },
          throws: [],
        };
      }

      return {
        returnType: this.checkIdentifierCallExpression(
          expression as CallExpressionNode & { callee: IdentifierExpressionNode }
        ),
        throws: [],
      };
    }

    if (expression.callee.kind === 'MemberExpression') {
      const memberObject: ClassReference | ResolvedType = this.resolveMemberObject(expression.callee.object);

      if (memberObject.kind === 'class_reference') {
        const methodLookup = this.findMethodEntryInHierarchy(memberObject.classEntry, expression.callee.property.name);

        if (methodLookup !== null) {
          return {
            returnType: methodLookup.methodEntry.returnType!,
            throws: methodLookup.methodEntry.throws,
          };
        }
      }

      if (memberObject.kind === 'class') {
        const classEntry: ClassEntry = this.classes.get(memberObject.name)!;
        const methodLookup = this.findMethodEntryInHierarchy(classEntry, expression.callee.property.name);

        if (methodLookup !== null) {
          return {
            returnType: methodLookup.methodEntry.returnType!,
            throws: methodLookup.methodEntry.throws,
          };
        }
      }
    }

    return {
      returnType: this.resolveExpressionType(expression),
      throws: [],
    };
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
      if (this.currentFunctionThrows.length === 0) {
        if (statement.values.length !== 0) {
          throw new CheckerError('Void functions must use "return;" without a value.', statement.location);
        }

        return;
      }

      if (statement.values.length !== 1) {
        throw new CheckerError('Void throwing functions must return exactly one error value.', statement.location);
      }

      this.assertThrowValueAssignable(this.currentFunctionThrows, statement.values[0]!);
      return;
    }

    if (this.currentFunctionThrows.length === 0) {
      if (statement.values.length !== 1) {
        throw new CheckerError('Non-void functions must return a value.', statement.location);
      }

      this.assertExpressionAssignable(this.currentFunctionReturnType, statement.values[0]!);
      return;
    }

    if (statement.values.length !== 2) {
      throw new CheckerError(
        'Throwing functions with a return value must return exactly two values.',
        statement.location
      );
    }

    this.assertExpressionAssignable(this.currentFunctionReturnType, statement.values[0]!);
    this.assertThrowValueAssignable(this.currentFunctionThrows, statement.values[1]!);
  }

  private checkStatement(statement: StatementNode): void {
    this.assertValidSpecialStatementUsage(statement);

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
      case 'DeferStatement':
        this.checkDeferStatement(statement);
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
      case 'MultiVariableDeclaration':
        this.checkMultiVariableDeclaration(statement);
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

  private assertValidSpecialStatementUsage(statement: StatementNode): void {
    switch (statement.kind) {
      case 'BlockStatement':
      case 'BreakStatement':
      case 'ContinueStatement':
        return;
      case 'DeferStatement':
        this.assertValidSpecialExpressionUsage(statement.expression);
        return;
      case 'DoWhileStatement':
        this.assertValidSpecialExpressionUsage(statement.condition);
        return;
      case 'ExpressionStatement':
        this.assertValidSpecialExpressionUsage(statement.expression);
        return;
      case 'ForStatement':
        if (statement.initializer.kind === 'VariableDeclaration') {
          this.assertValidSpecialExpressionUsage(statement.initializer.initializer);
        } else {
          this.assertValidSpecialExpressionUsage(statement.initializer);
        }

        this.assertValidSpecialExpressionUsage(statement.condition);
        this.assertValidSpecialExpressionUsage(statement.update);
        return;
      case 'IfStatement':
        this.assertValidSpecialExpressionUsage(statement.condition);
        return;
      case 'MultiVariableDeclaration':
        this.assertValidSpecialExpressionUsage(statement.initializer);
        return;
      case 'ReturnStatement':
        for (const value of statement.values) {
          this.assertValidSpecialExpressionUsage(value);
        }

        return;
      case 'VariableDeclaration':
        this.assertValidSpecialExpressionUsage(statement.initializer);
        return;
      case 'WhileStatement':
        this.assertValidSpecialExpressionUsage(statement.condition);
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

    if (topLevel.kind === 'VariableDeclaration') {
      this.checkTopLevelVariableDeclaration(topLevel);
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

  private assertValidSpecialExpressionUsage(
    expression: ExpressionNode,
    context: 'call-callee' | 'member-object' | 'none' = 'none'
  ): void {
    if (expression.kind === 'SuperExpression') {
      if (context !== 'call-callee' && context !== 'member-object') {
        throw new CheckerError('"super" can only be used as "super(...)" or "super.member".', expression.location);
      }

      return;
    }

    switch (expression.kind) {
      case 'AssignmentExpression':
        this.assertValidSpecialExpressionUsage(expression.target);
        this.assertValidSpecialExpressionUsage(expression.value);
        return;
      case 'BinaryExpression':
        this.assertValidSpecialExpressionUsage(expression.left);
        this.assertValidSpecialExpressionUsage(expression.right);
        return;
      case 'BooleanLiteral':
      case 'DoubleLiteral':
      case 'IdentifierExpression':
      case 'IntegerLiteral':
      case 'NullLiteral':
      case 'StringLiteral':
      case 'ThisExpression':
        return;
      case 'CallExpression':
        this.assertValidSpecialExpressionUsage(expression.callee, 'call-callee');

        for (const argument of expression.arguments) {
          this.assertValidSpecialExpressionUsage(argument);
        }

        return;
      case 'ConditionalExpression':
        this.assertValidSpecialExpressionUsage(expression.condition);
        this.assertValidSpecialExpressionUsage(expression.thenExpression);
        this.assertValidSpecialExpressionUsage(expression.elseExpression);
        return;
      case 'GroupingExpression':
        this.assertValidSpecialExpressionUsage(expression.expression);
        return;
      case 'MemberExpression':
        this.assertValidSpecialExpressionUsage(expression.object, 'member-object');
        return;
      case 'UnaryExpression':
        this.assertValidSpecialExpressionUsage(expression.expression);
        return;
    }
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

    if (declaredType.kind === 'unknown') {
      throw new CheckerError(
        'The "unknown" type is only allowed for error bindings from throwing calls.',
        declaration.type.location
      );
    }

    this.validateVariableInitializer(declaration, declaredType);

    currentScope.set(declaration.name.name, {
      declaredType: declaredType,
      mutability: declaration.mutability,
      type: declaredType,
    });
  }

  private checkTopLevelVariableDeclaration(declaration: VariableDeclarationNode): void {
    const currentScope: Map<string, SymbolEntry> = this.peekScope();
    const symbol: SymbolEntry | undefined = currentScope.get(declaration.name.name);

    if (symbol === undefined) {
      throw new CheckerError(`Variable "${declaration.name.name}" must be predeclared.`, declaration.name.location);
    }

    this.validateVariableInitializer(declaration, symbol.declaredType);
  }

  private validateVariableInitializer(declaration: VariableDeclarationNode, declaredType: ResolvedType): void {
    if (declaration.initializer.kind === 'CallExpression') {
      const throwsInfo: ThrowsCallInfo = this.resolveThrowsCallInfo(declaration.initializer);

      if (throwsInfo.throws.length > 0) {
        if (
          throwsInfo.returnType.kind !== 'primitive' ||
          throwsInfo.returnType.name !== 'void' ||
          throwsInfo.returnType.nullable
        ) {
          throw new CheckerError(
            'Throwing calls with a return value require multiple variable declarations.',
            declaration.initializer.location
          );
        }

        this.assertErrorBindingMatchesThrows(declaration.type, throwsInfo.throws);
        return;
      }
    }

    this.assertExpressionAssignable(declaredType, declaration.initializer);
  }

  private predeclareTopLevelVariable(declaration: VariableDeclarationNode): void {
    const currentScope: Map<string, SymbolEntry> = this.peekScope();

    if (
      currentScope.has(declaration.name.name) ||
      this.functions.has(declaration.name.name) ||
      this.classes.has(declaration.name.name)
    ) {
      throw new CheckerError(`Variable "${declaration.name.name}" is already declared.`, declaration.name.location);
    }

    const declaredType: ResolvedType = this.resolveType(declaration.type);

    if (declaredType.kind === 'primitive' && declaredType.name === 'void') {
      throw new CheckerError('Variables cannot use the void type.', declaration.type.location);
    }

    if (declaredType.kind === 'unknown') {
      throw new CheckerError(
        'The "unknown" type is only allowed for error bindings from throwing calls.',
        declaration.type.location
      );
    }

    currentScope.set(declaration.name.name, {
      declaredType,
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
    const existingClassEntry: ClassEntry | undefined = this.classes.get(declaration.name.name);

    if (existingClassEntry === undefined) {
      throw new CheckerError(
        `Class "${declaration.name.name}" must be predeclared before definition.`,
        declaration.name.location
      );
    }

    const baseClassName: string | null = declaration.baseName?.name ?? null;

    if (baseClassName !== null) {
      const baseClassEntry: ClassEntry | undefined = this.classes.get(baseClassName);

      if (baseClassEntry === undefined) {
        throw new CheckerError(`Unknown base class "${baseClassName}".`, declaration.baseName!.location);
      }

      if (baseClassName === declaration.name.name) {
        throw new CheckerError('Classes cannot extend themselves.', declaration.baseName!.location);
      }

      if (this.classChainContains(baseClassEntry, declaration.name.name)) {
        throw new CheckerError(
          `Class "${declaration.name.name}" cannot extend "${baseClassName}" because it would create an inheritance cycle.`,
          declaration.baseName!.location
        );
      }
    }

    const currentClassEntry: ClassEntry = existingClassEntry;
    const fields: Map<string, ClassFieldEntry> = new Map<string, ClassFieldEntry>();
    const methods: Map<string, ClassMethodEntry> = new Map<string, ClassMethodEntry>();
    let constructorMethod: ClassMethodEntry | null = null;

    for (const member of declaration.members) {
      if (member.kind === 'ClassFieldDeclaration') {
        if (fields.has(member.name.name) || methods.has(member.name.name) || member.name.name === 'constructor') {
          throw new CheckerError(`Class member "${member.name.name}" is already declared.`, member.name.location);
        }

        if (this.findFieldEntryInBaseHierarchy(currentClassEntry, member.name.name) !== null) {
          throw new CheckerError(
            `Field "${member.name.name}" is already declared in a base class and cannot be redeclared.`,
            member.name.location
          );
        }

        if (this.findMethodEntryInBaseHierarchy(currentClassEntry, member.name.name) !== null) {
          throw new CheckerError(
            `Field "${member.name.name}" conflicts with an inherited method and cannot be declared.`,
            member.name.location
          );
        }

        const fieldType: ResolvedType = this.resolveType(member.type);

        if ((fieldType.kind === 'primitive' && fieldType.name === 'void') || fieldType.kind === 'unknown') {
          throw new CheckerError('Fields cannot use the void or unknown types.', member.type.location);
        }

        fields.set(member.name.name, {
          declaration: member,
          mutability: member.mutability,
          ownerClassName: declaration.name.name,
          type: fieldType,
        });

        continue;
      }

      const methodEntry: ClassMethodEntry = {
        declaration: member,
        mutatesThis: this.methodMutatesThis(member),
        ownerClassName: declaration.name.name,
        parameters: this.resolveParameters(member.parameters, 'Method'),
        returnType: member.returnType === null ? null : this.resolveType(member.returnType),
        throws: this.resolveThrowsTypes(member.throws, member.location),
      };

      if (member.isConstructor) {
        if (member.isOverride) {
          throw new CheckerError('Constructors cannot use the "override" modifier.', member.location);
        }

        if (member.isStatic) {
          throw new CheckerError('Constructors cannot be static.', member.location);
        }

        if (member.throws.length > 0) {
          throw new CheckerError('Constructors cannot declare thrown types yet.', member.location);
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

      const inheritedFieldLookup = this.findFieldEntryInBaseHierarchy(currentClassEntry, member.name.name);

      if (inheritedFieldLookup !== null) {
        throw new CheckerError(
          `Method "${member.name.name}" conflicts with the inherited field "${member.name.name}".`,
          member.name.location
        );
      }

      const inheritedMethodLookup = this.findMethodEntryInBaseHierarchy(currentClassEntry, member.name.name);

      if (member.isStatic && member.name.name === 'toString') {
        throw new CheckerError('Static method "toString" is reserved as a builtin class method.', member.name.location);
      }

      if (member.isOverride && member.isStatic) {
        throw new CheckerError('Static methods cannot use the "override" modifier.', member.location);
      }

      if (
        methodEntry.returnType?.kind === 'primitive' &&
        methodEntry.returnType.name === 'void' &&
        methodEntry.returnType.nullable
      ) {
        throw new CheckerError('Methods cannot return "void?".', member.returnType!.location);
      }

      if (methodEntry.returnType?.kind === 'unknown') {
        throw new CheckerError('Methods cannot return the unknown type.', member.returnType!.location);
      }

      if (member.isOverride) {
        if (inheritedMethodLookup === null) {
          throw new CheckerError(
            `Method "${member.name.name}" uses "override" but no inherited method was found.`,
            member.name.location
          );
        }

        if (inheritedMethodLookup.methodEntry.declaration.access === 'private') {
          throw new CheckerError(
            `Method "${member.name.name}" cannot override a private inherited method.`,
            member.name.location
          );
        }

        if (inheritedMethodLookup.methodEntry.declaration.isStatic) {
          throw new CheckerError(
            `Method "${member.name.name}" cannot override the static inherited method "${member.name.name}".`,
            member.name.location
          );
        }

        if (!this.isSameParameterSignature(methodEntry.parameters, inheritedMethodLookup.methodEntry.parameters)) {
          throw new CheckerError(
            `Method "${member.name.name}" must match the inherited parameter signature when using "override".`,
            member.name.location
          );
        }

        if (!this.isSameType(methodEntry.returnType!, inheritedMethodLookup.methodEntry.returnType!)) {
          throw new CheckerError(
            `Method "${member.name.name}" must match the inherited return type when using "override".`,
            member.returnType!.location
          );
        }

        if (!this.isSameThrowsSignature(methodEntry.throws, inheritedMethodLookup.methodEntry.throws)) {
          throw new CheckerError(
            `Method "${member.name.name}" must match the inherited throws signature when using "override".`,
            member.location
          );
        }
      } else if (inheritedMethodLookup !== null && inheritedMethodLookup.methodEntry.declaration.access !== 'private') {
        throw new CheckerError(
          `Method "${member.name.name}" must use the "override" modifier because it overrides an inherited method.`,
          member.name.location
        );
      }

      methods.set(member.name.name, methodEntry);
    }

    this.classes.set(declaration.name.name, {
      baseClassName,
      constructorMethod,
      declaration,
      fields,
      methods,
    });
  }

  private declareFunction(statement: FunctionDeclarationNode): void {
    if (
      this.functions.has(statement.name.name) ||
      this.classes.has(statement.name.name) ||
      this.peekScope().has(statement.name.name)
    ) {
      throw new CheckerError(`Function "${statement.name.name}" is already declared.`, statement.name.location);
    }

    const parameters: ResolvedParameter[] = this.resolveParameters(statement.parameters, 'Function');
    const returnType: ResolvedType = this.resolveType(statement.returnType);

    if (returnType.kind === 'unknown') {
      throw new CheckerError('Functions cannot return the unknown type.', statement.returnType.location);
    }

    this.functions.set(statement.name.name, {
      declaration: statement,
      parameters,
      returnType,
      throws: this.resolveThrowsTypes(statement.throws, statement.location),
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
      expression.kind === 'SuperExpression' ||
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

    if (rootExpression.kind === 'SuperExpression') {
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

  private isSameParameterSignature(left: ResolvedParameter[], right: ResolvedParameter[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    return left.every((parameter: ResolvedParameter, index: number): boolean => {
      const otherParameter: ResolvedParameter = right[index]!;
      return parameter.mutability === otherParameter.mutability && this.isSameType(parameter.type, otherParameter.type);
    });
  }

  private isSameThrowsSignature(left: ResolvedType[], right: ResolvedType[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    return left.every((type: ResolvedType, index: number): boolean => this.isSameType(type, right[index]!));
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
          return statement.values.some(expressionMutatesThis);
        case 'DeferStatement':
          return expressionMutatesThis(statement.expression);
        case 'VariableDeclaration':
          return expressionMutatesThis(statement.initializer);
        case 'MultiVariableDeclaration':
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
          return (
            expression.target.kind === 'MemberExpression' &&
            (this.isThisFieldTarget(expression.target) || expression.target.object.kind === 'SuperExpression')
          );
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
        case 'SuperExpression':
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

  private resolveConditionNarrowings(expression: ExpressionNode): ConditionNarrowing[] {
    switch (expression.kind) {
      case 'BinaryExpression':
        if (expression.operator === '&&') {
          return [
            ...this.resolveConditionNarrowings(expression.left),
            ...this.resolveConditionNarrowings(expression.right),
          ];
        }

        return this.resolveNullCheckNarrowings(expression);
      case 'CallExpression':
        return this.resolveIsInstanceNarrowings(expression);
      case 'GroupingExpression':
        return this.resolveConditionNarrowings(expression.expression);
      default:
        return [];
    }
  }

  private resolveIsInstanceNarrowings(expression: CallExpressionNode): ConditionNarrowing[] {
    if (
      expression.callee.kind !== 'IdentifierExpression' ||
      expression.callee.name !== 'isInstance' ||
      expression.arguments.length !== 2
    ) {
      return [];
    }

    const instanceArgument: ExpressionNode = expression.arguments[0]!;
    const targetArgument: ExpressionNode = expression.arguments[1]!;

    if (instanceArgument.kind !== 'IdentifierExpression') {
      return [];
    }

    const symbol: SymbolEntry | undefined = this.tryResolveIdentifier(instanceArgument.name);

    if (symbol === undefined) {
      return [];
    }

    const targetObject: ClassReference | ResolvedType = this.resolveMemberObject(targetArgument);

    if (!('kind' in targetObject) || targetObject.kind !== 'class_reference') {
      return [];
    }

    return [
      {
        name: instanceArgument.name,
        type: {
          kind: 'class',
          name: targetObject.classEntry.declaration.name.name,
          nullable: false,
        },
      },
    ];
  }

  private resolveNullCheckNarrowings(expression: BinaryExpressionNode): ConditionNarrowing[] {
    if (expression.operator !== '!=') {
      return [];
    }

    let identifier: IdentifierExpressionNode | null = null;

    if (expression.left.kind === 'IdentifierExpression' && expression.right.kind === 'NullLiteral') {
      identifier = expression.left;
    } else if (expression.right.kind === 'IdentifierExpression' && expression.left.kind === 'NullLiteral') {
      identifier = expression.right;
    }

    if (identifier === null) {
      return [];
    }

    const symbol: SymbolEntry | undefined = this.tryResolveIdentifier(identifier.name);

    if (symbol === undefined || !symbol.type.nullable) {
      return [];
    }

    return [
      {
        name: identifier.name,
        type: {
          ...symbol.type,
          nullable: false,
        },
      },
    ];
  }

  private collectSuperConstructorCallsFromStatement(statement: StatementNode): CallExpressionNode[] {
    switch (statement.kind) {
      case 'BlockStatement':
        return statement.body.flatMap((innerStatement: StatementNode): CallExpressionNode[] =>
          this.collectSuperConstructorCallsFromStatement(innerStatement)
        );
      case 'BreakStatement':
      case 'ContinueStatement':
        return [];
      case 'DeferStatement':
        return this.collectSuperConstructorCallsFromExpression(statement.expression);
      case 'DoWhileStatement':
        return [
          ...this.collectSuperConstructorCallsFromStatement(statement.body),
          ...this.collectSuperConstructorCallsFromExpression(statement.condition),
        ];
      case 'ExpressionStatement':
        return this.collectSuperConstructorCallsFromExpression(statement.expression);
      case 'ForStatement':
        return [
          ...(statement.initializer.kind === 'VariableDeclaration'
            ? this.collectSuperConstructorCallsFromExpression(statement.initializer.initializer)
            : this.collectSuperConstructorCallsFromExpression(statement.initializer)),
          ...this.collectSuperConstructorCallsFromExpression(statement.condition),
          ...this.collectSuperConstructorCallsFromExpression(statement.update),
          ...this.collectSuperConstructorCallsFromStatement(statement.body),
        ];
      case 'IfStatement':
        return [
          ...this.collectSuperConstructorCallsFromExpression(statement.condition),
          ...this.collectSuperConstructorCallsFromStatement(statement.thenBranch),
          ...(statement.elseBranch === null
            ? []
            : statement.elseBranch.kind === 'BlockStatement'
              ? this.collectSuperConstructorCallsFromStatement(statement.elseBranch)
              : this.collectSuperConstructorCallsFromStatement(statement.elseBranch)),
        ];
      case 'MultiVariableDeclaration':
        return this.collectSuperConstructorCallsFromExpression(statement.initializer);
      case 'ReturnStatement':
        return statement.values.flatMap((value: ExpressionNode): CallExpressionNode[] =>
          this.collectSuperConstructorCallsFromExpression(value)
        );
      case 'VariableDeclaration':
        return this.collectSuperConstructorCallsFromExpression(statement.initializer);
      case 'WhileStatement':
        return [
          ...this.collectSuperConstructorCallsFromExpression(statement.condition),
          ...this.collectSuperConstructorCallsFromStatement(statement.body),
        ];
    }
  }

  private collectSuperConstructorCallsFromExpression(expression: ExpressionNode): CallExpressionNode[] {
    switch (expression.kind) {
      case 'AssignmentExpression':
        return [
          ...this.collectSuperConstructorCallsFromExpression(expression.target),
          ...this.collectSuperConstructorCallsFromExpression(expression.value),
        ];
      case 'BinaryExpression':
        return [
          ...this.collectSuperConstructorCallsFromExpression(expression.left),
          ...this.collectSuperConstructorCallsFromExpression(expression.right),
        ];
      case 'BooleanLiteral':
      case 'DoubleLiteral':
      case 'IdentifierExpression':
      case 'IntegerLiteral':
      case 'NullLiteral':
      case 'StringLiteral':
      case 'SuperExpression':
      case 'ThisExpression':
        return [];
      case 'CallExpression':
        return [
          ...(expression.callee.kind === 'SuperExpression'
            ? [expression]
            : this.collectSuperConstructorCallsFromExpression(expression.callee)),
          ...expression.arguments.flatMap((argument: ExpressionNode): CallExpressionNode[] =>
            this.collectSuperConstructorCallsFromExpression(argument)
          ),
        ];
      case 'ConditionalExpression':
        return [
          ...this.collectSuperConstructorCallsFromExpression(expression.condition),
          ...this.collectSuperConstructorCallsFromExpression(expression.thenExpression),
          ...this.collectSuperConstructorCallsFromExpression(expression.elseExpression),
        ];
      case 'GroupingExpression':
        return this.collectSuperConstructorCallsFromExpression(expression.expression);
      case 'MemberExpression':
        return this.collectSuperConstructorCallsFromExpression(expression.object);
      case 'UnaryExpression':
        return this.collectSuperConstructorCallsFromExpression(expression.expression);
    }
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
    const fieldLookup = this.findFieldEntryInHierarchy(classEntry, target.property.name);

    if (fieldLookup === null) {
      throw new CheckerError(
        `Class "${classEntry.declaration.name.name}" does not declare the field "${target.property.name}".`,
        target.property.location
      );
    }

    return {
      classEntry: fieldLookup.ownerClassEntry,
      fieldEntry: fieldLookup.fieldEntry,
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
      throw new CheckerError(
        `Operator "${expression.operator}" does not support class or unknown values.`,
        expression.location
      );
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

    if (leftType.kind === 'unknown' || rightType.kind === 'unknown') {
      throw new CheckerError('Equality is not supported for unknown values except against null.', expression.location);
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
      case 'SuperExpression':
        return this.resolveSuperExpressionType(expression.location);
      case 'ThisExpression':
        return this.resolveThisExpressionType(expression.location);
      case 'UnaryExpression':
        return this.resolveUnaryExpressionType(expression);
    }
  }

  private resolveIdentifier(expression: IdentifierExpressionNode): SymbolEntry {
    const symbol: SymbolEntry | undefined = this.tryResolveIdentifier(expression.name);

    if (symbol !== undefined) {
      return symbol;
    }

    throw new CheckerError(`Unknown variable "${expression.name}".`, expression.location);
  }

  private tryResolveIdentifier(name: string): SymbolEntry | undefined {
    for (let index = this.scopes.length - 1; index >= 0; index -= 1) {
      const symbol: SymbolEntry | undefined = this.scopes[index]?.get(name);

      if (symbol !== undefined) {
        return symbol;
      }
    }

    return undefined;
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

  private resolveThrowsTypes(types: TypeNode[], location: TokenLocation): ResolvedType[] {
    const resolvedThrows: ResolvedType[] = types.map((type: TypeNode): ResolvedType => {
      const resolvedType: ResolvedType = this.resolveType(type);

      if (resolvedType.nullable || resolvedType.kind !== 'class') {
        throw new CheckerError('Thrown types must be non-nullable class types.', type.location);
      }

      return resolvedType;
    });
    const thrownTypeNames: Set<string> = new Set<string>();

    for (const resolvedThrow of resolvedThrows) {
      if (thrownTypeNames.has(resolvedThrow.name)) {
        throw new CheckerError(`Thrown type "${resolvedThrow.name}" is already declared.`, location);
      }

      thrownTypeNames.add(resolvedThrow.name);
    }

    return resolvedThrows;
  }

  private resolveNamedType(type: NamedTypeNode): ResolvedType {
    if (type.name === 'unknown') {
      return {
        kind: 'unknown',
        name: 'unknown',
        nullable: false,
      };
    }

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

      if ((type.kind === 'primitive' && type.name === 'void') || type.kind === 'unknown') {
        throw new CheckerError(
          `${ownerLabel} parameters cannot use the void or unknown types.`,
          parameter.type.location
        );
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

  private assertErrorBindingMatchesThrows(type: TypeNode, throwsTypes: ResolvedType[]): void {
    const resolvedType: ResolvedType = this.resolveType(type);

    if (!resolvedType.nullable) {
      throw new CheckerError('Error bindings for throwing calls must be nullable.', type.location);
    }

    if (throwsTypes.length === 1) {
      const expectedType: ResolvedType = {
        ...throwsTypes[0]!,
        nullable: true,
      };

      if (!this.isSameType(resolvedType, expectedType)) {
        throw new CheckerError(
          `Error bindings for a single thrown type must use "${this.stringifyType(expectedType)}".`,
          type.location
        );
      }

      return;
    }

    if (resolvedType.kind !== 'unknown') {
      throw new CheckerError('Error bindings for multiple thrown types must use "unknown?".', type.location);
    }
  }

  private assertThrowValueAssignable(throwsTypes: ResolvedType[], expression: ExpressionNode): void {
    if (expression.kind === 'NullLiteral') {
      return;
    }

    const expressionType: ResolvedType = this.resolveExpressionType(expression);

    if (expressionType.nullable) {
      throw new CheckerError('Thrown values cannot be nullable.', expression.location);
    }

    const isAllowedType: boolean = throwsTypes.some((throwsType: ResolvedType): boolean =>
      this.isSameType(expressionType, throwsType)
    );

    if (!isAllowedType) {
      throw new CheckerError(
        `Cannot return "${this.stringifyType(expressionType)}" as one of "${throwsTypes.map((type): string => this.stringifyType(type)).join(', ')}".`,
        expression.location
      );
    }
  }

  private statementAlwaysReturns(statement: StatementNode): boolean {
    switch (statement.kind) {
      case 'BlockStatement':
        return this.statementListAlwaysReturns(statement.body);
      case 'IfStatement':
        if (statement.elseBranch === null) {
          return false;
        }

        if (statement.elseBranch.kind === 'BlockStatement') {
          return (
            this.statementListAlwaysReturns(statement.thenBranch.body) &&
            this.statementListAlwaysReturns(statement.elseBranch.body)
          );
        }

        return (
          this.statementListAlwaysReturns(statement.thenBranch.body) &&
          this.statementAlwaysReturns(statement.elseBranch)
        );
      case 'ReturnStatement':
        return true;
      case 'BreakStatement':
      case 'ContinueStatement':
      case 'DeferStatement':
      case 'DoWhileStatement':
      case 'ExpressionStatement':
      case 'ForStatement':
      case 'MultiVariableDeclaration':
      case 'VariableDeclaration':
      case 'WhileStatement':
        return false;
    }
  }

  private statementListAlwaysReturns(statements: StatementNode[]): boolean {
    for (const statement of statements) {
      if (this.statementAlwaysReturns(statement)) {
        return true;
      }
    }

    return false;
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

  private resolveSuperExpressionType(location: TokenLocation): ResolvedType {
    if (this.currentClass === null || this.currentMethod === null || this.currentMethod.declaration.isStatic) {
      throw new CheckerError('"super" can only be used inside instance methods and constructors.', location);
    }

    if (this.currentClass.baseClassName === null) {
      throw new CheckerError('"super" can only be used inside derived classes.', location);
    }

    return {
      kind: 'class',
      name: this.currentClass.baseClassName,
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
