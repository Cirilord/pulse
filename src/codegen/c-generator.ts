/* eslint-disable @typescript-eslint/member-ordering */
import { BUILTIN_ERROR_CLASS_NAME, createBuiltinErrorClassDeclaration } from '../builtins/error-class.js';
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
  ForInitializerNode,
  ForStatementNode,
  IfStatementNode,
  MemberExpressionNode,
  MultiVariableDeclarationNode,
  ProgramNode,
  ReturnStatementNode,
  StatementNode,
  TopLevelNode,
  TypeNode,
  VariableDeclarationNode,
  WhileStatementNode,
} from '../parser/ast/index.js';

type FunctionCodegenEntry = {
  declaration: FunctionDeclarationNode;
};

type ClassMethodCodegenEntry = {
  declaration: ClassMethodDeclarationNode;
  mutatesThis: boolean;
};

type ClassCodegenEntry = {
  constructorMethod: ClassMethodCodegenEntry | null;
  declaration: ClassDeclarationNode;
  fields: Map<string, ClassFieldDeclarationNode>;
  methods: Map<string, ClassMethodCodegenEntry>;
};

export class CGeneratorError extends Error {
  public readonly location: TokenLocation;

  public constructor(message: string, location: TokenLocation) {
    super(message);
    this.location = location;
    this.name = 'CGeneratorError';
  }
}

export class CGenerator {
  private readonly classes: Map<string, ClassCodegenEntry>;

  private currentClass: ClassCodegenEntry | null;

  private currentFunction: FunctionCodegenEntry | null;

  private currentMethod: ClassMethodCodegenEntry | null;

  private readonly functions: Map<string, FunctionCodegenEntry>;

  private readonly scopes: Map<string, TypeNode>[];

  private temporaryCounter: number;

  public constructor() {
    this.classes = new Map<string, ClassCodegenEntry>();
    this.currentClass = null;
    this.currentFunction = null;
    this.currentMethod = null;
    this.functions = new Map<string, FunctionCodegenEntry>();
    this.scopes = [];
    this.temporaryCounter = 0;
  }

  public generateProgram(program: ProgramNode): string {
    this.classes.clear();
    this.collectClasses(program);
    this.functions.clear();
    this.collectFunctions(program);
    this.scopes.length = 0;
    this.currentFunction = null;
    this.currentMethod = null;
    this.currentClass = null;
    this.temporaryCounter = 0;

    const usesBuiltinError: boolean = this.classes.has(BUILTIN_ERROR_CLASS_NAME);
    const usesStringType: boolean = usesBuiltinError || this.usesStringType(program);
    const usesStringEquality: boolean = this.usesStringEquality(program);
    const usesStringRuntimeHelpers: boolean = usesStringEquality || this.usesIsInstance(program);
    const usesUnknownType: boolean = this.usesUnknownType(program);
    const lines: string[] = ['#include <stdbool.h>', '#include <stddef.h>'];

    if (usesBuiltinError) {
      lines.push('#include <stdio.h>', '#include <stdlib.h>');
    }

    if (usesStringRuntimeHelpers) {
      lines.push('#include <string.h>');
    }

    lines.push('');

    if (usesStringType) {
      lines.push('typedef struct {');
      lines.push('  size_t length;');
      lines.push('  const char *data;');
      lines.push('} string_t;');
      lines.push('');
      lines.push('#define STRING_LITERAL(value) ((string_t){ sizeof(value) - 1, value })');
      lines.push('');
    }

    if (usesStringEquality) {
      lines.push('static bool string_t_equal(const string_t left, const string_t right) {');
      lines.push('  if (left.length != right.length) {');
      lines.push('    return false;');
      lines.push('  }');
      lines.push('');
      lines.push('  if (left.length == 0) {');
      lines.push('    return true;');
      lines.push('  }');
      lines.push('');
      lines.push('  return memcmp(left.data, right.data, left.length) == 0;');
      lines.push('}');
      lines.push('');
    }

    this.emitClassDefinitions(lines);

    if (usesUnknownType) {
      this.emitUnknownTypeDefinitions(lines);
    }

    if (usesBuiltinError) {
      this.emitRuntimeErrorHandler(lines);
    }

    this.emitNullableTypeDefinitions(program, lines);
    this.emitThrowingResultDefinitions(program, lines);
    this.emitPrototypes(program, lines);
    this.emitImplementations(program, lines);

    return `${lines.join('\n')}\n`;
  }

  private collectClasses(program: ProgramNode): void {
    if (this.usesBuiltinError(program)) {
      const errorClassDeclaration: ClassDeclarationNode = createBuiltinErrorClassDeclaration();

      this.classes.set(BUILTIN_ERROR_CLASS_NAME, {
        constructorMethod: {
          declaration: errorClassDeclaration.members[1] as ClassMethodDeclarationNode,
          mutatesThis: true,
        },
        declaration: errorClassDeclaration,
        fields: new Map<string, ClassFieldDeclarationNode>([
          ['message', errorClassDeclaration.members[0] as ClassFieldDeclarationNode],
        ]),
        methods: new Map<string, ClassMethodCodegenEntry>(),
      });
    }

    for (const topLevel of program.body) {
      if (topLevel.kind !== 'ClassDeclaration') {
        continue;
      }

      const fields: Map<string, ClassFieldDeclarationNode> = new Map<string, ClassFieldDeclarationNode>();
      const methods: Map<string, ClassMethodCodegenEntry> = new Map<string, ClassMethodCodegenEntry>();
      let constructorMethod: ClassMethodCodegenEntry | null = null;

      for (const member of topLevel.members) {
        if (member.kind === 'ClassFieldDeclaration') {
          fields.set(member.name.name, member);
          continue;
        }

        const methodEntry: ClassMethodCodegenEntry = {
          declaration: member,
          mutatesThis: this.methodMutatesThis(member),
        };

        if (member.isConstructor) {
          constructorMethod = methodEntry;
          continue;
        }

        methods.set(member.name.name, methodEntry);
      }

      this.classes.set(topLevel.name.name, {
        constructorMethod,
        declaration: topLevel,
        fields,
        methods,
      });
    }
  }

  private collectFunctions(program: ProgramNode): void {
    for (const topLevel of program.body) {
      if (topLevel.kind === 'FunctionDeclaration') {
        this.functions.set(topLevel.name.name, { declaration: topLevel });
      }
    }
  }

  private callableReturnsResultStruct(declaration: ClassMethodDeclarationNode | FunctionDeclarationNode): boolean {
    return (
      declaration.throws.length > 0 &&
      declaration.returnType !== null &&
      !(declaration.returnType.kind === 'NamedType' && declaration.returnType.name === 'void')
    );
  }

  private collectNullableTypeNames(program: ProgramNode): string[] {
    const typeNames: Set<string> = new Set<string>();

    const collectType = (type: TypeNode): void => {
      if (type.kind === 'NullableType') {
        typeNames.add(type.type.name);
      }
    };

    const collectThrows = (throwsTypes: TypeNode[]): void => {
      if (throwsTypes.length === 1) {
        const throwType: TypeNode = throwsTypes[0]!;
        typeNames.add(throwType.kind === 'NullableType' ? throwType.type.name : throwType.name);
        return;
      }

      if (throwsTypes.length > 1) {
        typeNames.add('unknown');
      }
    };

    const collectFromStatements = (statements: StatementNode[]): void => {
      for (const statement of statements) {
        switch (statement.kind) {
          case 'BlockStatement':
            collectFromStatements(statement.body);
            break;
          case 'DoWhileStatement':
            collectFromStatements(statement.body.body);
            break;
          case 'ForStatement':
            if (statement.initializer.kind === 'VariableDeclaration') {
              collectType(statement.initializer.type);
            }

            collectFromStatements(statement.body.body);
            break;
          case 'IfStatement':
            collectFromStatements(statement.thenBranch.body);

            if (statement.elseBranch?.kind === 'BlockStatement') {
              collectFromStatements(statement.elseBranch.body);
            }

            if (statement.elseBranch?.kind === 'IfStatement') {
              collectFromStatements([statement.elseBranch]);
            }

            break;
          case 'MultiVariableDeclaration':
            for (const binding of statement.bindings) {
              collectType(binding.type);
            }
            break;
          case 'VariableDeclaration':
            collectType(statement.type);
            break;
          case 'WhileStatement':
            collectFromStatements(statement.body.body);
            break;
          case 'BreakStatement':
          case 'ContinueStatement':
          case 'ExpressionStatement':
          case 'ReturnStatement':
            break;
        }
      }
    };

    for (const topLevel of program.body) {
      if (topLevel.kind === 'ClassDeclaration') {
        for (const member of topLevel.members) {
          if (member.kind === 'ClassFieldDeclaration') {
            collectType(member.type);
            continue;
          }

          for (const parameter of member.parameters) {
            collectType(parameter.type);
          }

          if (member.returnType !== null) {
            collectType(member.returnType);
          }

          collectThrows(member.throws);

          collectFromStatements(member.body.body);
        }

        continue;
      }

      if (topLevel.kind === 'FunctionDeclaration') {
        collectType(topLevel.returnType);

        for (const parameter of topLevel.parameters) {
          collectType(parameter.type);
        }

        collectThrows(topLevel.throws);

        collectFromStatements(topLevel.body.body);
      }
    }

    return [...typeNames].sort();
  }

  private emitClassDefinitions(lines: string[]): void {
    for (const classEntry of this.classes.values()) {
      lines.push('typedef struct {');
      lines.push('  const char *pulse__type_name;');

      for (const field of classEntry.fields.values()) {
        lines.push(`  ${this.generateType(field.type, 'var')} ${field.name.name};`);
      }

      lines.push(`} ${classEntry.declaration.name.name};`);
      lines.push('');
    }
  }

  private emitImplementations(program: ProgramNode, lines: string[]): void {
    for (const classEntry of this.classes.values()) {
      if (classEntry.constructorMethod !== null) {
        lines.push(...this.generateClassMethodDeclaration(classEntry, classEntry.constructorMethod));
        lines.push('');
      }

      for (const methodEntry of classEntry.methods.values()) {
        lines.push(...this.generateClassMethodDeclaration(classEntry, methodEntry));
        lines.push('');
      }
    }

    for (const functionDeclaration of this.getFunctionDeclarations(program)) {
      lines.push(...this.generateFunctionDeclaration(functionDeclaration));
      lines.push('');
    }
  }

  private emitRuntimeErrorHandler(lines: string[]): void {
    lines.push(`void pulse__runtime__handle_error(const ${BUILTIN_ERROR_CLASS_NAME} error) {`);
    lines.push('  fprintf(stderr, "%.*s\\n", (int)error.message.length, error.message.data);');
    lines.push('  exit(EXIT_FAILURE);');
    lines.push('}');
    lines.push('');
  }

  private emitThrowingResultDefinitions(program: ProgramNode, lines: string[]): void {
    for (const classEntry of this.classes.values()) {
      if (
        classEntry.constructorMethod !== null &&
        this.callableReturnsResultStruct(classEntry.constructorMethod.declaration)
      ) {
        lines.push(`typedef struct {`);
        lines.push(`  ${this.generateType(classEntry.constructorMethod.declaration.returnType!, 'var')} value;`);
        lines.push(`  ${this.getThrowErrorCType(classEntry.constructorMethod.declaration.throws)} error;`);
        lines.push(
          `} ${this.getCallableResultTypeName(classEntry.declaration.name.name, classEntry.constructorMethod.declaration)};`
        );
        lines.push('');
      }

      for (const methodEntry of classEntry.methods.values()) {
        if (!this.callableReturnsResultStruct(methodEntry.declaration)) {
          continue;
        }

        lines.push(`typedef struct {`);
        lines.push(`  ${this.generateType(methodEntry.declaration.returnType!, 'var')} value;`);
        lines.push(`  ${this.getThrowErrorCType(methodEntry.declaration.throws)} error;`);
        lines.push(`} ${this.getCallableResultTypeName(classEntry.declaration.name.name, methodEntry.declaration)};`);
        lines.push('');
      }
    }

    for (const functionDeclaration of this.getFunctionDeclarations(program)) {
      if (!this.callableReturnsResultStruct(functionDeclaration)) {
        continue;
      }

      lines.push('typedef struct {');
      lines.push(`  ${this.generateType(functionDeclaration.returnType, 'var')} value;`);
      lines.push(`  ${this.getThrowErrorCType(functionDeclaration.throws)} error;`);
      lines.push(`} ${this.getCallableResultTypeName(null, functionDeclaration)};`);
      lines.push('');
    }
  }

  private emitUnknownTypeDefinitions(lines: string[]): void {
    lines.push('typedef union {');

    for (const classEntry of this.classes.values()) {
      lines.push(`  ${classEntry.declaration.name.name} ${classEntry.declaration.name.name}_value;`);
    }

    lines.push('} unknown_value_t;');
    lines.push('');
    lines.push('typedef struct {');
    lines.push('  const char *type_name;');
    lines.push('  unknown_value_t value;');
    lines.push('} unknown_t;');
    lines.push('');
  }

  private emitNullableTypeDefinitions(program: ProgramNode, lines: string[]): void {
    for (const nullableTypeName of this.collectNullableTypeNames(program)) {
      lines.push('typedef struct {');
      lines.push('  bool is_null;');
      lines.push(`  ${this.getNonNullableCType(nullableTypeName)} value;`);
      lines.push(`} ${this.getNullableCType(nullableTypeName)};`);
      lines.push('');
    }
  }

  private emitPrototypes(program: ProgramNode, lines: string[]): void {
    const prototypes: string[] = [];

    for (const classEntry of this.classes.values()) {
      if (classEntry.constructorMethod !== null) {
        prototypes.push(this.generateClassMethodPrototype(classEntry, classEntry.constructorMethod));
      }

      for (const methodEntry of classEntry.methods.values()) {
        prototypes.push(this.generateClassMethodPrototype(classEntry, methodEntry));
      }
    }

    for (const functionDeclaration of this.getFunctionDeclarations(program)) {
      prototypes.push(this.generateFunctionPrototype(functionDeclaration));
    }

    lines.push(...prototypes);

    if (prototypes.length > 0) {
      lines.push('');
    }
  }

  private expressionUsesStringEquality(expression: ExpressionNode): boolean {
    switch (expression.kind) {
      case 'AssignmentExpression':
        return this.expressionUsesStringEquality(expression.value);
      case 'BinaryExpression':
        if (expression.operator === '==' || expression.operator === '!=') {
          return this.isStringEquality(expression);
        }

        return (
          this.expressionUsesStringEquality(expression.left) || this.expressionUsesStringEquality(expression.right)
        );
      case 'CallExpression':
        return expression.arguments.some((argument: ExpressionNode): boolean =>
          this.expressionUsesStringEquality(argument)
        );
      case 'ConditionalExpression':
        return (
          this.expressionUsesStringEquality(expression.condition) ||
          this.expressionUsesStringEquality(expression.thenExpression) ||
          this.expressionUsesStringEquality(expression.elseExpression)
        );
      case 'GroupingExpression':
      case 'UnaryExpression':
        return this.expressionUsesStringEquality(expression.expression);
      case 'MemberExpression':
        return this.expressionUsesStringEquality(expression.object);
      case 'BooleanLiteral':
      case 'DoubleLiteral':
      case 'IdentifierExpression':
      case 'IntegerLiteral':
      case 'NullLiteral':
      case 'StringLiteral':
      case 'ThisExpression':
        return false;
    }
  }

  private generateAddressableObjectExpression(expression: ExpressionNode): string {
    if (expression.kind === 'ThisExpression') {
      return 'self';
    }

    const objectExpression: string = this.generateExpression(expression);

    if (expression.kind === 'IdentifierExpression') {
      return `&${objectExpression}`;
    }

    return `&(${objectExpression})`;
  }

  private generateAssignedValue(type: TypeNode, expression: ExpressionNode): string {
    if (type.kind === 'NullableType') {
      if (type.type.name === 'unknown') {
        return this.generateUnknownNullableValue(expression);
      }

      if (expression.kind === 'NullLiteral') {
        return `(${this.getNullableCType(type.type.name)}){ .is_null = true, .value = ${this.getDefaultValue(type.type.name)} }`;
      }

      return `(${this.getNullableCType(type.type.name)}){ .is_null = false, .value = ${this.generateNonNullableValue(
        type.type.name,
        expression
      )} }`;
    }

    if (type.name === 'unknown') {
      return this.generateUnknownValue(expression);
    }

    return this.generateNonNullableValue(type.name, expression);
  }

  private generateAssignmentTarget(target: AssignmentExpressionNode['target']): string {
    if (target.kind === 'IdentifierExpression') {
      return target.name;
    }

    return this.generateFieldAccess(target);
  }

  private generateBlockStatement(statement: BlockStatementNode, indentLevel: number): string[] {
    return this.generateScopedBlock(statement.body, indentLevel, `${this.indent(indentLevel)}{`);
  }

  private generateBreakStatement(_statement: BreakStatementNode, indentLevel: number): string[] {
    return [`${this.indent(indentLevel)}break;`];
  }

  private generateCallExpression(expression: CallExpressionNode): string {
    if (expression.callee.kind === 'IdentifierExpression') {
      if (expression.callee.name === 'isInstance') {
        const classNameArgument: string | null = this.resolveClassReferenceName(expression.arguments[1]!);

        if (classNameArgument === null) {
          throw new CGeneratorError(
            'Function "isInstance" expects a class reference as the second argument.',
            expression.location
          );
        }

        return this.generateIsInstanceExpression(expression.arguments[0]!, classNameArgument);
      }

      if (this.classes.has(expression.callee.name)) {
        const classEntry: ClassCodegenEntry = this.classes.get(expression.callee.name)!;
        const constructorMethod: ClassMethodCodegenEntry | null = classEntry.constructorMethod;

        if (constructorMethod === null) {
          throw new CGeneratorError(
            `Class "${expression.callee.name}" does not declare a constructor.`,
            expression.callee.location
          );
        }

        const argumentsList: string = this.generateCallArguments(
          expression.arguments,
          constructorMethod.declaration.parameters
        );

        return `${expression.callee.name}__constructor(${argumentsList})`;
      }

      const functionEntry: FunctionCodegenEntry | undefined = this.functions.get(expression.callee.name);

      if (functionEntry === undefined) {
        throw new CGeneratorError(`Unknown function "${expression.callee.name}".`, expression.callee.location);
      }

      const argumentsList: string = this.generateCallArguments(
        expression.arguments,
        functionEntry.declaration.parameters
      );

      return `${expression.callee.name}(${argumentsList})`;
    }

    if (expression.callee.kind !== 'MemberExpression') {
      throw new CGeneratorError('Only named calls are supported.', expression.callee.location);
    }

    const classReferenceName: string | null = this.resolveClassReferenceName(expression.callee.object);

    if (classReferenceName !== null) {
      const classEntry: ClassCodegenEntry = this.classes.get(classReferenceName)!;
      const methodEntry: ClassMethodCodegenEntry | undefined = classEntry.methods.get(expression.callee.property.name);

      if (methodEntry === undefined) {
        throw new CGeneratorError(
          `Unknown static method "${expression.callee.property.name}".`,
          expression.callee.property.location
        );
      }

      const argumentsList: string = this.generateCallArguments(
        expression.arguments,
        methodEntry.declaration.parameters
      );

      return `${classReferenceName}__static_method__${expression.callee.property.name}(${argumentsList})`;
    }

    const instanceTypeName: string = this.resolveClassTypeName(this.resolveExpressionType(expression.callee.object));
    const classEntry: ClassCodegenEntry = this.classes.get(instanceTypeName)!;
    const methodEntry: ClassMethodCodegenEntry | undefined = classEntry.methods.get(expression.callee.property.name);

    if (methodEntry === undefined) {
      throw new CGeneratorError(
        `Unknown instance method "${expression.callee.property.name}".`,
        expression.callee.property.location
      );
    }

    const receiver: string = this.generateAddressableObjectExpression(expression.callee.object);
    const argumentsList: string = this.generateCallArguments(expression.arguments, methodEntry.declaration.parameters);
    const joinedArguments: string = argumentsList.length === 0 ? receiver : `${receiver}, ${argumentsList}`;

    return `${instanceTypeName}__method__${expression.callee.property.name}(${joinedArguments})`;
  }

  private generateCallArguments(argumentsList: ExpressionNode[], parameters: FunctionParameterNode[]): string {
    return argumentsList
      .map((argument: ExpressionNode, index: number): string => {
        const parameter: FunctionParameterNode | undefined = parameters[index];

        if (parameter === undefined) {
          return this.generateExpression(argument);
        }

        return this.generateTypedExpression(parameter.type, argument);
      })
      .join(', ');
  }

  private generateClassMethodDeclaration(
    classEntry: ClassCodegenEntry,
    methodEntry: ClassMethodCodegenEntry
  ): string[] {
    this.pushScope();
    const previousClass: ClassCodegenEntry | null = this.currentClass;
    const previousFunction: FunctionCodegenEntry | null = this.currentFunction;
    const previousMethod: ClassMethodCodegenEntry | null = this.currentMethod;
    this.currentClass = classEntry;
    this.currentFunction = null;
    this.currentMethod = methodEntry;

    for (const parameter of methodEntry.declaration.parameters) {
      this.peekScope().set(parameter.name.name, parameter.type);
    }

    const lines: string[] = [this.generateClassMethodPrototype(classEntry, methodEntry).replace(/;$/u, ' {')];

    if (methodEntry.declaration.isConstructor) {
      lines.push(
        `${this.indent(1)}${classEntry.declaration.name.name} self = (${classEntry.declaration.name.name}){ 0 };`
      );
      lines.push(`${this.indent(1)}self.pulse__type_name = "${classEntry.declaration.name.name}";`);
    }

    for (const statement of methodEntry.declaration.body.body) {
      lines.push(...this.generateStatement(statement, 1));
    }

    if (methodEntry.declaration.isConstructor) {
      lines.push(`${this.indent(1)}return self;`);
    }

    this.currentClass = previousClass;
    this.currentFunction = previousFunction;
    this.currentMethod = previousMethod;
    this.popScope();
    lines.push('}');

    return lines;
  }

  private generateClassMethodName(className: string, method: ClassMethodDeclarationNode): string {
    if (method.isConstructor) {
      return `${className}__constructor`;
    }

    if (method.isStatic) {
      return `${className}__static_method__${method.name.name}`;
    }

    return `${className}__method__${method.name.name}`;
  }

  private getCallableResultTypeName(
    ownerClassName: string | null,
    declaration: ClassMethodDeclarationNode | FunctionDeclarationNode
  ): string {
    if (ownerClassName === null) {
      return `${declaration.name.name}__result_t`;
    }

    return `${this.generateClassMethodName(ownerClassName, declaration as ClassMethodDeclarationNode)}__result_t`;
  }

  private getThrowErrorCType(throwsTypes: TypeNode[]): string {
    if (throwsTypes.length === 1) {
      const throwType: TypeNode = throwsTypes[0]!;
      return this.getNullableCType(throwType.kind === 'NullableType' ? throwType.type.name : throwType.name);
    }

    return this.getNullableCType('unknown');
  }

  private generateCallableCType(
    ownerClassName: string | null,
    declaration: ClassMethodDeclarationNode | FunctionDeclarationNode
  ): string {
    if (declaration.throws.length === 0) {
      if ('isConstructor' in declaration && declaration.isConstructor) {
        return ownerClassName ?? declaration.name.name;
      }

      return this.generateType(declaration.returnType!, 'var');
    }

    if (this.callableReturnsResultStruct(declaration)) {
      return this.getCallableResultTypeName(ownerClassName, declaration);
    }

    return this.getThrowErrorCType(declaration.throws);
  }

  private getCurrentCallableDeclaration(): ClassMethodDeclarationNode | FunctionDeclarationNode {
    if (this.currentMethod !== null) {
      return this.currentMethod.declaration;
    }

    if (this.currentFunction !== null) {
      return this.currentFunction.declaration;
    }

    throw new Error('C generator requires an active callable declaration.');
  }

  private generateClassMethodPrototype(classEntry: ClassCodegenEntry, methodEntry: ClassMethodCodegenEntry): string {
    const method: ClassMethodDeclarationNode = methodEntry.declaration;
    const returnType: string = this.generateCallableCType(classEntry.declaration.name.name, method);

    if (method.isConstructor) {
      const parameters: string = method.parameters
        .map((parameter: FunctionParameterNode): string => this.generateFunctionParameter(parameter))
        .join(', ');

      return `${returnType} ${this.generateClassMethodName(classEntry.declaration.name.name, method)}(${parameters.length > 0 ? parameters : 'void'});`;
    }

    const parameters: string[] = [];

    if (!method.isStatic) {
      parameters.push(`${methodEntry.mutatesThis ? '' : 'const '}${classEntry.declaration.name.name} *self`);
    }

    for (const parameter of method.parameters) {
      parameters.push(this.generateFunctionParameter(parameter));
    }

    return `${returnType} ${this.generateClassMethodName(classEntry.declaration.name.name, method)}(${parameters.length > 0 ? parameters.join(', ') : 'void'});`;
  }

  private generateConditionalExpression(expression: ConditionalExpressionNode): string {
    const resultType: TypeNode = this.resolveExpressionType(expression);
    const conditionExpression: string = this.generateExpression(expression.condition);
    const elseExpression: string = this.generateTypedExpression(resultType, expression.elseExpression);
    const thenExpression: string = this.generateTypedExpression(resultType, expression.thenExpression);

    return `(${conditionExpression} ? ${thenExpression} : ${elseExpression})`;
  }

  private generateContinueStatement(_statement: ContinueStatementNode, indentLevel: number): string[] {
    return [`${this.indent(indentLevel)}continue;`];
  }

  private generateDoWhileStatement(statement: DoWhileStatementNode, indentLevel: number): string[] {
    const lines: string[] = [`${this.indent(indentLevel)}do {`];

    this.pushScope();

    for (const bodyStatement of statement.body.body) {
      lines.push(...this.generateStatement(bodyStatement, indentLevel + 1));
    }

    this.popScope();
    lines.push(`${this.indent(indentLevel)}} while (${this.generateExpression(statement.condition)});`);

    return lines;
  }

  private generateEqualityExpression(expression: BinaryExpressionNode): string {
    if (expression.left.kind === 'NullLiteral' && expression.right.kind === 'NullLiteral') {
      return expression.operator === '==' ? 'true' : 'false';
    }

    if (expression.left.kind === 'NullLiteral') {
      const rightType: TypeNode = this.resolveExpressionType(expression.right);

      if (rightType.kind !== 'NullableType') {
        throw new CGeneratorError('Null equality requires a nullable operand.', expression.location);
      }

      const rightExpression: string = this.generateExpression(expression.right);

      return expression.operator === '==' ? `(${rightExpression}.is_null)` : `(!${rightExpression}.is_null)`;
    }

    if (expression.right.kind === 'NullLiteral') {
      const leftType: TypeNode = this.resolveExpressionType(expression.left);

      if (leftType.kind !== 'NullableType') {
        throw new CGeneratorError('Null equality requires a nullable operand.', expression.location);
      }

      const leftExpression: string = this.generateExpression(expression.left);

      return expression.operator === '==' ? `(${leftExpression}.is_null)` : `(!${leftExpression}.is_null)`;
    }

    const leftType: TypeNode = this.resolveExpressionType(expression.left);
    const rightType: TypeNode = this.resolveExpressionType(expression.right);

    if (leftType.kind === 'NullableType' || rightType.kind === 'NullableType') {
      return this.generateNullableEqualityExpression(expression, leftType, rightType);
    }

    if (
      leftType.kind === 'NamedType' &&
      leftType.name === 'string' &&
      rightType.kind === 'NamedType' &&
      rightType.name === 'string'
    ) {
      return `(string_t_equal(${this.generateNonNullableValue('string', expression.left)}, ${this.generateNonNullableValue('string', expression.right)})${
        expression.operator === '!=' ? ' == false' : ''
      })`;
    }

    return `(${this.generateExpression(expression.left)} ${expression.operator} ${this.generateExpression(expression.right)})`;
  }

  private generateExpression(expression: ExpressionNode): string {
    switch (expression.kind) {
      case 'AssignmentExpression':
        if (expression.operator === '&&=' || expression.operator === '||=') {
          return this.generateLogicalAssignmentExpression(expression);
        }

        if (expression.operator === '??=') {
          return this.generateNullCoalescingAssignmentExpression(expression);
        }

        return `${this.generateAssignmentTarget(expression.target)} ${expression.operator} ${this.generateAssignedValue(
          this.resolveAssignmentTargetType(expression.target),
          expression.value
        )}`;
      case 'BinaryExpression':
        if (expression.operator === '??') {
          return this.generateNullCoalescingExpression(expression);
        }

        if (expression.operator === '==' || expression.operator === '!=') {
          return this.generateEqualityExpression(expression);
        }

        return `(${this.generateExpression(expression.left)} ${expression.operator} ${this.generateExpression(expression.right)})`;
      case 'BooleanLiteral':
        return expression.value ? 'true' : 'false';
      case 'CallExpression':
        return this.generateCallExpression(expression);
      case 'ConditionalExpression':
        return this.generateConditionalExpression(expression);
      case 'DoubleLiteral':
        return String(expression.value);
      case 'GroupingExpression':
        return `(${this.generateExpression(expression.expression)})`;
      case 'IdentifierExpression':
        return expression.name;
      case 'IntegerLiteral':
        return String(expression.value);
      case 'MemberExpression':
        return this.generateFieldAccess(expression);
      case 'NullLiteral':
        throw new CGeneratorError('Null literals must be emitted in a nullable context.', expression.location);
      case 'StringLiteral':
        return JSON.stringify(expression.value);
      case 'ThisExpression':
        return '(*self)';
      case 'UnaryExpression':
        return `(${expression.operator}${this.generateExpression(expression.expression)})`;
    }
  }

  private generateExpressionStatement(statement: ExpressionStatementNode): string {
    return `${this.generateExpression(statement.expression)};`;
  }

  private generateFieldAccess(expression: MemberExpressionNode): string {
    if (expression.object.kind === 'ThisExpression') {
      return this.currentMethod?.declaration.isConstructor
        ? `self.${expression.property.name}`
        : `self->${expression.property.name}`;
    }

    const classReferenceName: string | null = this.resolveClassReferenceName(expression.object);

    if (classReferenceName !== null) {
      throw new CGeneratorError('Static members cannot be accessed as values.', expression.location);
    }

    const objectExpression: string = this.generateExpression(expression.object);

    if (expression.object.kind === 'IdentifierExpression') {
      return `${objectExpression}.${expression.property.name}`;
    }

    return `(${objectExpression}).${expression.property.name}`;
  }

  private generateIsInstanceExpression(expression: ExpressionNode, className: string): string {
    const expressionType: TypeNode = this.resolveExpressionType(expression);
    const generatedExpression: string = this.generateExpression(expression);

    if (expressionType.kind === 'NullableType') {
      if (expressionType.type.name === 'unknown') {
        return `(!${generatedExpression}.is_null && strcmp(${generatedExpression}.value.type_name, "${className}") == 0)`;
      }

      return `(!${generatedExpression}.is_null && strcmp(${generatedExpression}.value.pulse__type_name, "${className}") == 0)`;
    }

    if (expressionType.name === 'unknown') {
      return `(strcmp(${generatedExpression}.type_name, "${className}") == 0)`;
    }

    return `(strcmp(${this.generateTypeNameAccess(expression)}, "${className}") == 0)`;
  }

  private generateTypeNameAccess(expression: ExpressionNode): string {
    if (expression.kind === 'ThisExpression') {
      return this.currentMethod?.declaration.isConstructor ? 'self.pulse__type_name' : 'self->pulse__type_name';
    }

    if (expression.kind === 'IdentifierExpression') {
      return `${expression.name}.pulse__type_name`;
    }

    return `(${this.generateExpression(expression)}).pulse__type_name`;
  }

  private generateForInitializer(initializer: ForInitializerNode): string {
    if (initializer.kind === 'VariableDeclaration') {
      const declaration: string = this.generateVariableDeclaration(initializer);

      return declaration.slice(0, -1);
    }

    return this.generateExpression(initializer);
  }

  private generateForStatement(statement: ForStatementNode, indentLevel: number): string[] {
    this.pushScope();

    const initializer: string = this.generateForInitializer(statement.initializer);
    const condition: string = this.generateExpression(statement.condition);
    const update: string = this.generateExpression(statement.update);
    const lines: string[] = [`${this.indent(indentLevel)}for (${initializer}; ${condition}; ${update}) {`];

    this.pushScope();

    for (const bodyStatement of statement.body.body) {
      lines.push(...this.generateStatement(bodyStatement, indentLevel + 1));
    }

    this.popScope();
    this.popScope();
    lines.push(`${this.indent(indentLevel)}}`);

    return lines;
  }

  private generateFunctionDeclaration(statement: FunctionDeclarationNode): string[] {
    this.pushScope();
    const previousFunction: FunctionCodegenEntry | null = this.currentFunction;
    const previousMethod: ClassMethodCodegenEntry | null = this.currentMethod;
    const previousClass: ClassCodegenEntry | null = this.currentClass;
    this.currentFunction = this.functions.get(statement.name.name)!;
    this.currentMethod = null;
    this.currentClass = null;

    for (const parameter of statement.parameters) {
      this.peekScope().set(parameter.name.name, parameter.type);
    }

    const lines: string[] = [this.generateFunctionPrototype(statement).replace(/;$/u, ' {')];

    for (const bodyStatement of statement.body.body) {
      lines.push(...this.generateStatement(bodyStatement, 1));
    }

    this.currentFunction = previousFunction;
    this.currentMethod = previousMethod;
    this.currentClass = previousClass;
    this.popScope();
    lines.push('}');

    return lines;
  }

  private generateFunctionParameter(parameter: FunctionParameterNode): string {
    return `${this.generateType(parameter.type, parameter.mutability)} ${parameter.name.name}`;
  }

  private generateFunctionPrototype(statement: FunctionDeclarationNode): string {
    const parameters: string = statement.parameters
      .map((parameter: FunctionParameterNode): string => this.generateFunctionParameter(parameter))
      .join(', ');
    const cParameters: string = parameters.length > 0 ? parameters : 'void';

    return `${this.generateCallableCType(null, statement)} ${statement.name.name}(${cParameters});`;
  }

  private generateIfStatement(statement: IfStatementNode, indentLevel: number, isElseIf: boolean = false): string[] {
    const openingLine: string = `${this.indent(indentLevel)}${isElseIf ? 'else if' : 'if'} (${this.generateExpression(statement.condition)}) {`;
    const lines: string[] = this.generateScopedBlock(statement.thenBranch.body, indentLevel, openingLine);

    if (statement.elseBranch === null) {
      return lines;
    }

    if (statement.elseBranch.kind === 'BlockStatement') {
      lines.push(
        ...this.generateScopedBlock(statement.elseBranch.body, indentLevel, `${this.indent(indentLevel)}else {`)
      );
      return lines;
    }

    lines.push(...this.generateIfStatement(statement.elseBranch, indentLevel, true));

    return lines;
  }

  private generateLogicalAssignmentExpression(expression: AssignmentExpressionNode): string {
    const operator: string = expression.operator === '&&=' ? '&&' : '||';
    const targetExpression: string = this.generateAssignmentTarget(expression.target);
    const valueExpression: string = this.generateExpression(expression.value);

    return `${targetExpression} = (${targetExpression} ${operator} ${valueExpression})`;
  }

  private generateNonNullableValue(typeName: string, expression: ExpressionNode): string {
    if (typeName === 'string' && expression.kind === 'StringLiteral') {
      return `STRING_LITERAL(${this.generateExpression(expression)})`;
    }

    if (typeName === 'char' && expression.kind === 'StringLiteral') {
      return `'${expression.value}'`;
    }

    if (typeName === 'float' && expression.kind === 'DoubleLiteral') {
      return `${this.generateExpression(expression)}f`;
    }

    return this.generateExpression(expression);
  }

  private generateNullCoalescingAssignmentExpression(expression: AssignmentExpressionNode): string {
    const targetType: TypeNode = this.resolveAssignmentTargetType(expression.target);

    if (targetType.kind !== 'NullableType') {
      throw new CGeneratorError('Null coalescing assignment requires a nullable target.', expression.location);
    }

    const targetExpression: string = this.generateAssignmentTarget(expression.target);
    const assignedValue: string = this.generateAssignedValue(targetType, expression.value);

    return `${targetExpression} = (${targetExpression}.is_null ? ${assignedValue} : ${targetExpression})`;
  }

  private generateNullCoalescingExpression(expression: BinaryExpressionNode): string {
    const rightType: TypeNode = this.resolveExpressionType(expression.right);

    if (expression.left.kind === 'NullLiteral') {
      return rightType.kind === 'NullableType'
        ? this.generateExpression(expression.right)
        : this.generateNonNullableValue(rightType.name, expression.right);
    }

    const leftType: TypeNode = this.resolveExpressionType(expression.left);

    if (leftType.kind !== 'NullableType') {
      throw new CGeneratorError('Null coalescing requires a nullable left operand.', expression.left.location);
    }

    const leftExpression: string = this.generateExpression(expression.left);
    const rightExpression: string =
      rightType.kind === 'NullableType'
        ? this.generateExpression(expression.right)
        : this.generateNonNullableValue(rightType.name, expression.right);

    if (rightType.kind === 'NullableType') {
      return `(${leftExpression}.is_null ? ${rightExpression} : ${leftExpression})`;
    }

    return `(${leftExpression}.is_null ? ${rightExpression} : ${leftExpression}.value)`;
  }

  private generateNullableEqualityExpression(
    expression: BinaryExpressionNode,
    leftType: TypeNode,
    rightType: TypeNode
  ): string {
    if (leftType.kind !== 'NullableType' || rightType.kind !== 'NullableType') {
      throw new CGeneratorError('Nullable equality requires nullable operands.', expression.location);
    }

    const leftExpression: string = this.generateExpression(expression.left);
    const rightExpression: string = this.generateExpression(expression.right);
    const valueExpression: string =
      leftType.type.name === 'string'
        ? `string_t_equal(${leftExpression}.value, ${rightExpression}.value)`
        : `${leftExpression}.value == ${rightExpression}.value`;
    const equalityExpression: string = `(${leftExpression}.is_null ? ${rightExpression}.is_null : (!${rightExpression}.is_null && ${valueExpression}))`;

    if (expression.operator === '!=') {
      return `(!${equalityExpression})`;
    }

    return equalityExpression;
  }

  private generateThrowErrorValue(throwsTypes: TypeNode[], expression: ExpressionNode): string {
    if (throwsTypes.length === 1) {
      return this.generateAssignedValue(
        {
          kind: 'NullableType',
          location: expression.location,
          type: throwsTypes[0] as Extract<TypeNode, { kind: 'NamedType' }>,
        },
        expression
      );
    }

    return this.generateUnknownNullableValue(expression);
  }

  private generateUnknownNullableValue(expression: ExpressionNode): string {
    if (expression.kind === 'NullLiteral') {
      return `(${this.getNullableCType('unknown')}){ .is_null = true, .value = { .type_name = NULL } }`;
    }

    return `(${this.getNullableCType('unknown')}){ .is_null = false, .value = ${this.generateUnknownValue(expression)} }`;
  }

  private generateUnknownValue(expression: ExpressionNode): string {
    const expressionType: TypeNode = this.resolveExpressionType(expression);
    const classTypeName: string =
      expressionType.kind === 'NullableType'
        ? this.resolveClassTypeName(expressionType.type)
        : this.resolveClassTypeName(expressionType);
    const valueExpression: string =
      expressionType.kind === 'NullableType'
        ? `${this.generateExpression(expression)}.value`
        : this.generateExpression(expression);

    return `(unknown_t){ .type_name = "${classTypeName}", .value.${classTypeName}_value = ${valueExpression} }`;
  }

  private generateReturnStatement(statement: ReturnStatementNode, indentLevel: number): string[] {
    const declaration: ClassMethodDeclarationNode | FunctionDeclarationNode = this.getCurrentCallableDeclaration();
    const returnType: TypeNode | null = declaration.returnType;

    if (declaration.throws.length === 0) {
      if (statement.values.length === 0) {
        return [`${this.indent(indentLevel)}return;`];
      }

      return [`${this.indent(indentLevel)}return ${this.generateExpression(statement.values[0]!)};`];
    }

    if (returnType !== null && returnType.kind === 'NamedType' && returnType.name === 'void') {
      return [
        `${this.indent(indentLevel)}return ${this.generateThrowErrorValue(declaration.throws, statement.values[0]!)};`,
      ];
    }

    if (returnType === null) {
      throw new CGeneratorError('Constructors cannot use throwing return values.', statement.location);
    }

    return [
      `${this.indent(indentLevel)}return (${this.getCallableResultTypeName(
        this.currentClass?.declaration.name.name ?? null,
        declaration
      )}){ .value = ${this.generateAssignedValue(returnType, statement.values[0]!)}, .error = ${this.generateThrowErrorValue(
        declaration.throws,
        statement.values[1]!
      )} };`,
    ];
  }

  private generateScopedBlock(statements: StatementNode[], indentLevel: number, openingLine: string): string[] {
    const lines: string[] = [openingLine];

    this.pushScope();

    for (const statement of statements) {
      lines.push(...this.generateStatement(statement, indentLevel + 1));
    }

    this.popScope();
    lines.push(`${this.indent(indentLevel)}}`);

    return lines;
  }

  private generateStatement(statement: StatementNode, indentLevel: number): string[] {
    switch (statement.kind) {
      case 'BlockStatement':
        return this.generateBlockStatement(statement, indentLevel);
      case 'BreakStatement':
        return this.generateBreakStatement(statement, indentLevel);
      case 'ContinueStatement':
        return this.generateContinueStatement(statement, indentLevel);
      case 'DoWhileStatement':
        return this.generateDoWhileStatement(statement, indentLevel);
      case 'ExpressionStatement':
        return [`${this.indent(indentLevel)}${this.generateExpressionStatement(statement)}`];
      case 'ForStatement':
        return this.generateForStatement(statement, indentLevel);
      case 'IfStatement':
        return this.generateIfStatement(statement, indentLevel);
      case 'MultiVariableDeclaration':
        return this.generateMultiVariableDeclaration(statement, indentLevel);
      case 'ReturnStatement':
        return this.generateReturnStatement(statement, indentLevel);
      case 'VariableDeclaration':
        return [`${this.indent(indentLevel)}${this.generateVariableDeclaration(statement)}`];
      case 'WhileStatement':
        return this.generateWhileStatement(statement, indentLevel);
    }
  }

  private generateType(type: TypeNode, mutability: 'val' | 'var'): string {
    if (type.kind === 'NullableType') {
      const nullableCType: string = this.getNullableCType(type.type.name);

      return this.shouldEmitConst(type, mutability) ? `const ${nullableCType}` : nullableCType;
    }

    const cType: string = this.getNonNullableCType(type.name);

    return this.shouldEmitConst(type, mutability) ? `const ${cType}` : cType;
  }

  private generateTypedExpression(type: TypeNode, expression: ExpressionNode): string {
    if (type.kind === 'NullableType') {
      return this.generateAssignedValue(type, expression);
    }

    return this.generateNonNullableValue(type.name, expression);
  }

  private generateVariableDeclaration(declaration: VariableDeclarationNode): string {
    const cType: string = this.generateType(declaration.type, declaration.mutability);
    let initializer: string = this.generateAssignedValue(declaration.type, declaration.initializer);

    if (declaration.initializer.kind === 'CallExpression') {
      const throwsReturnType: TypeNode | null = this.resolveThrowsReturnType(declaration.initializer);

      if (throwsReturnType !== null && throwsReturnType.kind === 'NamedType' && throwsReturnType.name === 'void') {
        initializer = this.generateCallExpression(declaration.initializer);
      }
    }

    this.peekScope().set(declaration.name.name, declaration.type);

    return `${cType} ${declaration.name.name} = ${initializer};`;
  }

  private generateMultiVariableDeclaration(statement: MultiVariableDeclarationNode, indentLevel: number): string[] {
    if (statement.initializer.kind !== 'CallExpression') {
      throw new CGeneratorError(
        'Multiple variable declarations require a call expression.',
        statement.initializer.location
      );
    }

    const resultType: TypeNode | null = this.resolveThrowsReturnType(statement.initializer);

    if (resultType === null || (resultType.kind === 'NamedType' && resultType.name === 'void')) {
      throw new CGeneratorError(
        'Multiple variable declarations require a throwing call with a return value.',
        statement.initializer.location
      );
    }

    const resultVariableName: string = `pulse__result_${this.temporaryCounter++}`;
    const lines: string[] = [
      `${this.indent(indentLevel)}const ${this.resolveCallResultCType(statement.initializer)} ${resultVariableName} = ${this.generateCallExpression(statement.initializer)};`,
    ];
    const valueBinding = statement.bindings[0]!;
    const errorBinding = statement.bindings[1]!;
    const valueType: string = this.generateType(valueBinding.type, valueBinding.mutability);
    const errorType: string = this.generateType(errorBinding.type, errorBinding.mutability);

    this.peekScope().set(valueBinding.name.name, valueBinding.type);
    this.peekScope().set(errorBinding.name.name, errorBinding.type);

    lines.push(`${this.indent(indentLevel)}${valueType} ${valueBinding.name.name} = ${resultVariableName}.value;`);
    lines.push(`${this.indent(indentLevel)}${errorType} ${errorBinding.name.name} = ${resultVariableName}.error;`);

    return lines;
  }

  private generateWhileStatement(statement: WhileStatementNode, indentLevel: number): string[] {
    const openingLine: string = `${this.indent(indentLevel)}while (${this.generateExpression(statement.condition)}) {`;

    return this.generateScopedBlock(statement.body.body, indentLevel, openingLine);
  }

  private getDefaultValue(typeName: string): string {
    switch (typeName) {
      case 'boolean':
        return 'false';
      case 'byte':
        return '0';
      case 'char':
        return "'\\0'";
      case 'double':
        return '0.0';
      case 'float':
        return '0.0f';
      case 'int':
        return '0';
      case 'unknown':
        return '(unknown_t){ .type_name = NULL }';
      case 'string':
        return '(string_t){ .length = 0, .data = NULL }';
      default:
        if (this.classes.has(typeName)) {
          return `(${typeName}){ 0 }`;
        }

        throw new Error(`Unsupported default value for "${typeName}".`);
    }
  }

  private getFunctionDeclarations(program: ProgramNode): FunctionDeclarationNode[] {
    for (const topLevel of program.body) {
      if (topLevel.kind !== 'ClassDeclaration' && topLevel.kind !== 'FunctionDeclaration') {
        throw new CGeneratorError(
          'Top-level statements are not allowed. Declare functions and classes only.',
          topLevel.location
        );
      }
    }

    return program.body.filter(function isFunctionDeclaration(topLevel): topLevel is FunctionDeclarationNode {
      return topLevel.kind === 'FunctionDeclaration';
    });
  }

  private getNonNullableCType(typeName: string): string {
    switch (typeName) {
      case 'boolean':
        return 'bool';
      case 'byte':
        return 'unsigned char';
      case 'char':
        return 'char';
      case 'double':
        return 'double';
      case 'float':
        return 'float';
      case 'int':
        return 'int';
      case 'unknown':
        return 'unknown_t';
      case 'string':
        return 'string_t';
      case 'void':
        return 'void';
      default:
        if (this.classes.has(typeName)) {
          return typeName;
        }

        throw new Error(`Unsupported C type for "${typeName}".`);
    }
  }

  private getNullableCType(typeName: string): string {
    return `${this.getNonNullableCType(typeName)}_nullable`;
  }

  private indent(level: number): string {
    return '  '.repeat(level);
  }

  private isPrimitiveTypeName(typeName: string): boolean {
    return (
      typeName === 'boolean' ||
      typeName === 'byte' ||
      typeName === 'char' ||
      typeName === 'double' ||
      typeName === 'float' ||
      typeName === 'int' ||
      typeName === 'unknown' ||
      typeName === 'string' ||
      typeName === 'void'
    );
  }

  private isStringEquality(expression: BinaryExpressionNode): boolean {
    if (expression.left.kind === 'NullLiteral' || expression.right.kind === 'NullLiteral') {
      const nonNullSide: ExpressionNode = expression.left.kind === 'NullLiteral' ? expression.right : expression.left;
      const nonNullType: TypeNode = this.resolveExpressionType(nonNullSide);

      return (
        (nonNullType.kind === 'NullableType' && nonNullType.type.name === 'string') ||
        (nonNullType.kind === 'NamedType' && nonNullType.name === 'string')
      );
    }

    const leftType: TypeNode = this.resolveExpressionType(expression.left);
    const rightType: TypeNode = this.resolveExpressionType(expression.right);

    return (
      ((leftType.kind === 'NullableType' && leftType.type.name === 'string') ||
        (leftType.kind === 'NamedType' && leftType.name === 'string')) &&
      ((rightType.kind === 'NullableType' && rightType.type.name === 'string') ||
        (rightType.kind === 'NamedType' && rightType.name === 'string'))
    );
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
        case 'MultiVariableDeclaration':
          return expressionMutatesThis(statement.initializer);
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
          return expression.target.kind === 'MemberExpression' && expression.target.object.kind === 'ThisExpression';
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

  private peekScope(): Map<string, TypeNode> {
    const scope: Map<string, TypeNode> | undefined = this.scopes.at(-1);

    if (scope === undefined) {
      throw new Error('C generator requires at least one active scope.');
    }

    return scope;
  }

  private popScope(): void {
    const scope: Map<string, TypeNode> | undefined = this.scopes.pop();

    if (scope === undefined) {
      throw new Error('C generator cannot pop an empty scope stack.');
    }
  }

  private pushScope(): void {
    this.scopes.push(new Map<string, TypeNode>());
  }

  private resolveAssignmentTargetType(target: AssignmentExpressionNode['target']): TypeNode {
    if (target.kind === 'IdentifierExpression') {
      return this.resolveVariableType(target.name);
    }

    return this.resolveFieldType(target);
  }

  private resolveClassReferenceName(expression: ExpressionNode): string | null {
    if (
      expression.kind === 'IdentifierExpression' &&
      this.classes.has(expression.name) &&
      !this.scopeContains(expression.name)
    ) {
      return expression.name;
    }

    return null;
  }

  private resolveClassTypeName(type: TypeNode): string {
    if (type.kind === 'NullableType') {
      throw new CGeneratorError('Expected a non-nullable class type.', type.location);
    }

    if (this.isPrimitiveTypeName(type.name)) {
      throw new CGeneratorError('Expected a class type.', type.location);
    }

    return type.name;
  }

  private resolveConditionalExpressionType(expression: ConditionalExpressionNode): TypeNode {
    if (expression.thenExpression.kind === 'NullLiteral' && expression.elseExpression.kind === 'NullLiteral') {
      throw new CGeneratorError('Conditional expressions cannot use null in both branches.', expression.location);
    }

    if (expression.thenExpression.kind === 'NullLiteral') {
      return this.resolveExpressionType(expression.elseExpression);
    }

    if (expression.elseExpression.kind === 'NullLiteral') {
      return this.resolveExpressionType(expression.thenExpression);
    }

    return this.resolveExpressionType(expression.thenExpression);
  }

  private resolveExpressionType(expression: ExpressionNode): TypeNode {
    switch (expression.kind) {
      case 'AssignmentExpression':
        return this.resolveAssignmentTargetType(expression.target);
      case 'BinaryExpression':
        if (expression.operator === '??') {
          return this.resolveNullCoalescingType(expression);
        }

        if (
          expression.operator === '&&' ||
          expression.operator === '||' ||
          expression.operator === '==' ||
          expression.operator === '!=' ||
          expression.operator === '<' ||
          expression.operator === '<=' ||
          expression.operator === '>' ||
          expression.operator === '>='
        ) {
          return { kind: 'NamedType', location: expression.location, name: 'boolean' };
        }

        return this.resolveNonNullableTypeNode(expression.left);
      case 'BooleanLiteral':
        return { kind: 'NamedType', location: expression.location, name: 'boolean' };
      case 'CallExpression':
        return this.resolveCallExpressionType(expression);
      case 'ConditionalExpression':
        return this.resolveConditionalExpressionType(expression);
      case 'DoubleLiteral':
        return { kind: 'NamedType', location: expression.location, name: 'double' };
      case 'GroupingExpression':
        return this.resolveExpressionType(expression.expression);
      case 'IdentifierExpression':
        return this.resolveIdentifierOrClassType(expression);
      case 'IntegerLiteral':
        return { kind: 'NamedType', location: expression.location, name: 'int' };
      case 'MemberExpression':
        return this.resolveFieldType(expression);
      case 'NullLiteral':
        throw new CGeneratorError('Null literals cannot be resolved without context.', expression.location);
      case 'StringLiteral':
        return { kind: 'NamedType', location: expression.location, name: 'string' };
      case 'ThisExpression':
        if (this.currentClass === null) {
          throw new CGeneratorError('"this" is only available inside class methods.', expression.location);
        }

        return {
          kind: 'NamedType',
          location: expression.location,
          name: this.currentClass.declaration.name.name,
        };
      case 'UnaryExpression':
        if (expression.operator === '!') {
          return { kind: 'NamedType', location: expression.location, name: 'boolean' };
        }

        return this.resolveExpressionType(expression.expression);
    }
  }

  private resolveFieldType(expression: MemberExpressionNode): TypeNode {
    const classReferenceName: string | null = this.resolveClassReferenceName(expression.object);

    if (classReferenceName !== null) {
      throw new CGeneratorError('Static members cannot be accessed as values.', expression.location);
    }

    const objectType: TypeNode = this.resolveExpressionType(expression.object);
    const classTypeName: string = this.resolveClassTypeName(objectType);
    const classEntry: ClassCodegenEntry | undefined = this.classes.get(classTypeName);
    const fieldEntry: ClassFieldDeclarationNode | undefined = classEntry?.fields.get(expression.property.name);

    if (fieldEntry === undefined) {
      throw new CGeneratorError(
        `Unknown field "${expression.property.name}" on "${classTypeName}".`,
        expression.property.location
      );
    }

    return fieldEntry.type;
  }

  private resolveIdentifierOrClassType(expression: ExpressionNode & { kind: 'IdentifierExpression' }): TypeNode {
    for (let index = this.scopes.length - 1; index >= 0; index -= 1) {
      const typeNode: TypeNode | undefined = this.scopes[index]?.get(expression.name);

      if (typeNode !== undefined) {
        return typeNode;
      }
    }

    if (this.classes.has(expression.name)) {
      return {
        kind: 'NamedType',
        location: expression.location,
        name: expression.name,
      };
    }

    throw new Error(`Unknown variable "${expression.name}" in C generator.`);
  }

  private resolveCallExpressionType(expression: CallExpressionNode): TypeNode {
    if (expression.callee.kind === 'IdentifierExpression') {
      if (expression.callee.name === 'isInstance') {
        return { kind: 'NamedType', location: expression.location, name: 'boolean' };
      }

      const functionEntry: FunctionCodegenEntry | undefined = this.functions.get(expression.callee.name);

      if (functionEntry !== undefined) {
        return functionEntry.declaration.returnType;
      }

      if (this.classes.has(expression.callee.name)) {
        return {
          kind: 'NamedType',
          location: expression.location,
          name: expression.callee.name,
        };
      }
    }

    if (expression.callee.kind === 'MemberExpression') {
      const classReferenceName: string | null = this.resolveClassReferenceName(expression.callee.object);

      if (classReferenceName !== null) {
        const classEntry: ClassCodegenEntry = this.classes.get(classReferenceName)!;
        const methodEntry: ClassMethodCodegenEntry | undefined = classEntry.methods.get(
          expression.callee.property.name
        );

        if (methodEntry === undefined || methodEntry.declaration.returnType === null) {
          throw new CGeneratorError('Unknown static method.', expression.callee.property.location);
        }

        return methodEntry.declaration.returnType;
      }

      const objectType: TypeNode = this.resolveExpressionType(expression.callee.object);
      const classTypeName: string = this.resolveClassTypeName(objectType);
      const classEntry: ClassCodegenEntry = this.classes.get(classTypeName)!;
      const methodEntry: ClassMethodCodegenEntry | undefined = classEntry.methods.get(expression.callee.property.name);

      if (methodEntry === undefined || methodEntry.declaration.returnType === null) {
        throw new CGeneratorError('Unknown instance method.', expression.callee.property.location);
      }

      return methodEntry.declaration.returnType;
    }

    throw new CGeneratorError('Only named calls are supported.', expression.callee.location);
  }

  private resolveCallResultCType(expression: CallExpressionNode): string {
    if (expression.callee.kind === 'IdentifierExpression') {
      const functionEntry: FunctionCodegenEntry | undefined = this.functions.get(expression.callee.name);

      if (functionEntry !== undefined) {
        return this.generateCallableCType(null, functionEntry.declaration);
      }
    }

    if (expression.callee.kind === 'MemberExpression') {
      const classReferenceName: string | null = this.resolveClassReferenceName(expression.callee.object);

      if (classReferenceName !== null) {
        const classEntry: ClassCodegenEntry = this.classes.get(classReferenceName)!;
        const methodEntry: ClassMethodCodegenEntry | undefined = classEntry.methods.get(
          expression.callee.property.name
        );

        if (methodEntry !== undefined) {
          return this.generateCallableCType(classReferenceName, methodEntry.declaration);
        }
      }

      const objectType: TypeNode = this.resolveExpressionType(expression.callee.object);
      const classTypeName: string = this.resolveClassTypeName(objectType);
      const classEntry: ClassCodegenEntry = this.classes.get(classTypeName)!;
      const methodEntry: ClassMethodCodegenEntry | undefined = classEntry.methods.get(expression.callee.property.name);

      if (methodEntry !== undefined) {
        return this.generateCallableCType(classTypeName, methodEntry.declaration);
      }
    }

    throw new CGeneratorError('Only named calls are supported.', expression.callee.location);
  }

  private resolveThrowsReturnType(expression: CallExpressionNode): TypeNode | null {
    if (expression.callee.kind === 'IdentifierExpression') {
      const functionEntry: FunctionCodegenEntry | undefined = this.functions.get(expression.callee.name);

      if (functionEntry !== undefined && functionEntry.declaration.throws.length > 0) {
        return functionEntry.declaration.returnType;
      }

      return null;
    }

    if (expression.callee.kind === 'MemberExpression') {
      const classReferenceName: string | null = this.resolveClassReferenceName(expression.callee.object);

      if (classReferenceName !== null) {
        const classEntry: ClassCodegenEntry = this.classes.get(classReferenceName)!;
        const methodEntry: ClassMethodCodegenEntry | undefined = classEntry.methods.get(
          expression.callee.property.name
        );

        if (methodEntry !== undefined && methodEntry.declaration.throws.length > 0) {
          return methodEntry.declaration.returnType;
        }

        return null;
      }

      const objectType: TypeNode = this.resolveExpressionType(expression.callee.object);
      const classTypeName: string = this.resolveClassTypeName(objectType);
      const classEntry: ClassCodegenEntry = this.classes.get(classTypeName)!;
      const methodEntry: ClassMethodCodegenEntry | undefined = classEntry.methods.get(expression.callee.property.name);

      if (methodEntry !== undefined && methodEntry.declaration.throws.length > 0) {
        return methodEntry.declaration.returnType;
      }
    }

    return null;
  }

  private resolveNonNullableTypeNode(expression: ExpressionNode): TypeNode {
    const typeNode: TypeNode = this.resolveExpressionType(expression);

    if (typeNode.kind === 'NullableType') {
      throw new CGeneratorError('Expected a non-nullable expression type.', expression.location);
    }

    return typeNode;
  }

  private resolveNullCoalescingType(expression: BinaryExpressionNode): TypeNode {
    if (expression.left.kind === 'NullLiteral') {
      return this.resolveExpressionType(expression.right);
    }

    const leftType: TypeNode = this.resolveExpressionType(expression.left);

    if (leftType.kind !== 'NullableType') {
      throw new CGeneratorError('Null coalescing requires a nullable left operand.', expression.left.location);
    }

    if (expression.right.kind === 'NullLiteral') {
      return leftType;
    }

    return this.resolveExpressionType(expression.right);
  }

  private resolveVariableType(name: string): TypeNode {
    for (let index = this.scopes.length - 1; index >= 0; index -= 1) {
      const typeNode: TypeNode | undefined = this.scopes[index]?.get(name);

      if (typeNode !== undefined) {
        return typeNode;
      }
    }

    throw new Error(`Unknown variable "${name}" in C generator.`);
  }

  private scopeContains(name: string): boolean {
    for (let index = this.scopes.length - 1; index >= 0; index -= 1) {
      if (this.scopes[index]?.has(name)) {
        return true;
      }
    }

    return false;
  }

  private shouldEmitConst(type: TypeNode, mutability: 'val' | 'var'): boolean {
    if (mutability !== 'val') {
      return false;
    }

    const typeName: string = type.kind === 'NullableType' ? type.type.name : type.name;

    return this.isPrimitiveTypeName(typeName);
  }

  private typeUsesString(type: TypeNode): boolean {
    if (type.kind === 'NullableType') {
      return type.type.name === 'string';
    }

    return type.name === 'string';
  }

  private typeUsesBuiltinError(type: TypeNode): boolean {
    if (type.kind === 'NullableType') {
      return type.type.name === BUILTIN_ERROR_CLASS_NAME;
    }

    return type.name === BUILTIN_ERROR_CLASS_NAME;
  }

  private typeUsesUnknown(type: TypeNode): boolean {
    if (type.kind === 'NullableType') {
      return type.type.name === 'unknown';
    }

    return type.name === 'unknown';
  }

  private usesStringEquality(program: ProgramNode): boolean {
    const usesStringEqualityInStatements = (statements: StatementNode[]): boolean => {
      return statements.some((statement: StatementNode): boolean => {
        if (statement.kind === 'BlockStatement') {
          this.pushScope();
          const blockUsesStringEquality: boolean = usesStringEqualityInStatements(statement.body);
          this.popScope();
          return blockUsesStringEquality;
        }

        if (statement.kind === 'IfStatement') {
          if (this.expressionUsesStringEquality(statement.condition)) {
            return true;
          }

          this.pushScope();
          const thenBranchUsesStringEquality: boolean = usesStringEqualityInStatements(statement.thenBranch.body);
          this.popScope();

          if (thenBranchUsesStringEquality) {
            return true;
          }

          if (statement.elseBranch === null) {
            return false;
          }

          if (statement.elseBranch.kind === 'BlockStatement') {
            this.pushScope();
            const elseBranchUsesStringEquality: boolean = usesStringEqualityInStatements(statement.elseBranch.body);
            this.popScope();

            return elseBranchUsesStringEquality;
          }

          return usesStringEqualityInStatements([statement.elseBranch]);
        }

        if (statement.kind === 'DoWhileStatement') {
          if (this.expressionUsesStringEquality(statement.condition)) {
            return true;
          }

          this.pushScope();
          const bodyUsesStringEquality: boolean = usesStringEqualityInStatements(statement.body.body);
          this.popScope();

          return bodyUsesStringEquality;
        }

        if (statement.kind === 'ForStatement') {
          this.pushScope();

          if (statement.initializer.kind === 'VariableDeclaration') {
            const initializerUsesStringEquality: boolean = this.expressionUsesStringEquality(
              statement.initializer.initializer
            );
            this.peekScope().set(statement.initializer.name.name, statement.initializer.type);
            const conditionUsesStringEquality: boolean = this.expressionUsesStringEquality(statement.condition);
            const updateUsesStringEquality: boolean = this.expressionUsesStringEquality(statement.update);
            const bodyUsesStringEquality: boolean = usesStringEqualityInStatements(statement.body.body);
            this.popScope();

            return (
              initializerUsesStringEquality ||
              conditionUsesStringEquality ||
              updateUsesStringEquality ||
              bodyUsesStringEquality
            );
          }

          const initializerUsesStringEquality: boolean = this.expressionUsesStringEquality(statement.initializer);
          const conditionUsesStringEquality: boolean = this.expressionUsesStringEquality(statement.condition);
          const updateUsesStringEquality: boolean = this.expressionUsesStringEquality(statement.update);
          const bodyUsesStringEquality: boolean = usesStringEqualityInStatements(statement.body.body);
          this.popScope();

          return (
            initializerUsesStringEquality ||
            conditionUsesStringEquality ||
            updateUsesStringEquality ||
            bodyUsesStringEquality
          );
        }

        if (statement.kind === 'WhileStatement') {
          if (this.expressionUsesStringEquality(statement.condition)) {
            return true;
          }

          this.pushScope();
          const bodyUsesStringEquality: boolean = usesStringEqualityInStatements(statement.body.body);
          this.popScope();

          return bodyUsesStringEquality;
        }

        if (statement.kind === 'BreakStatement' || statement.kind === 'ContinueStatement') {
          return false;
        }

        if (statement.kind === 'ExpressionStatement') {
          return this.expressionUsesStringEquality(statement.expression);
        }

        if (statement.kind === 'ReturnStatement') {
          return statement.values.some((value: ExpressionNode): boolean => this.expressionUsesStringEquality(value));
        }

        if (statement.kind === 'MultiVariableDeclaration') {
          const declarationUsesStringEquality: boolean = this.expressionUsesStringEquality(statement.initializer);

          for (const binding of statement.bindings) {
            this.peekScope().set(binding.name.name, binding.type);
          }

          return declarationUsesStringEquality;
        }

        const declarationUsesStringEquality: boolean = this.expressionUsesStringEquality(statement.initializer);
        this.peekScope().set(statement.name.name, statement.type);

        if (declarationUsesStringEquality) {
          return true;
        }

        return false;
      });
    };

    this.scopes.length = 0;

    return program.body.some((topLevel: TopLevelNode): boolean => {
      if (topLevel.kind === 'ClassDeclaration') {
        return topLevel.members.some((member): boolean => {
          if (member.kind !== 'ClassMethodDeclaration') {
            return false;
          }

          this.pushScope();

          for (const parameter of member.parameters) {
            this.peekScope().set(parameter.name.name, parameter.type);
          }

          const bodyUsesStringEquality: boolean = usesStringEqualityInStatements(member.body.body);
          this.popScope();

          return bodyUsesStringEquality;
        });
      }

      if (topLevel.kind === 'FunctionDeclaration') {
        this.pushScope();

        for (const parameter of topLevel.parameters) {
          this.peekScope().set(parameter.name.name, parameter.type);
        }

        const bodyUsesStringEquality: boolean = usesStringEqualityInStatements(topLevel.body.body);
        this.popScope();

        return bodyUsesStringEquality;
      }

      return false;
    });
  }

  private usesStringType(program: ProgramNode): boolean {
    const usesStringTypeInStatements = (statements: StatementNode[]): boolean => {
      return statements.some((statement: StatementNode): boolean => {
        if (statement.kind === 'BlockStatement') {
          return usesStringTypeInStatements(statement.body);
        }

        if (statement.kind === 'DoWhileStatement') {
          return usesStringTypeInStatements(statement.body.body);
        }

        if (statement.kind === 'ForStatement') {
          return (
            (statement.initializer.kind === 'VariableDeclaration' && this.typeUsesString(statement.initializer.type)) ||
            usesStringTypeInStatements(statement.body.body)
          );
        }

        if (statement.kind === 'IfStatement') {
          return (
            usesStringTypeInStatements(statement.thenBranch.body) ||
            (statement.elseBranch?.kind === 'BlockStatement' &&
              usesStringTypeInStatements(statement.elseBranch.body)) ||
            (statement.elseBranch?.kind === 'IfStatement' && usesStringTypeInStatements([statement.elseBranch]))
          );
        }

        if (statement.kind === 'VariableDeclaration') {
          return this.typeUsesString(statement.type);
        }

        if (statement.kind === 'MultiVariableDeclaration') {
          return statement.bindings.some((binding): boolean => this.typeUsesString(binding.type));
        }

        if (statement.kind === 'WhileStatement') {
          return usesStringTypeInStatements(statement.body.body);
        }

        return false;
      });
    };

    return program.body.some((topLevel: TopLevelNode): boolean => {
      if (topLevel.kind === 'ClassDeclaration') {
        return topLevel.members.some((member): boolean => {
          if (member.kind === 'ClassFieldDeclaration') {
            return this.typeUsesString(member.type);
          }

          return (
            member.parameters.some((parameter: FunctionParameterNode): boolean =>
              this.typeUsesString(parameter.type)
            ) ||
            (member.returnType !== null && this.typeUsesString(member.returnType)) ||
            usesStringTypeInStatements(member.body.body)
          );
        });
      }

      if (topLevel.kind === 'FunctionDeclaration') {
        return (
          this.typeUsesString(topLevel.returnType) ||
          topLevel.parameters.some((parameter: FunctionParameterNode): boolean =>
            this.typeUsesString(parameter.type)
          ) ||
          usesStringTypeInStatements(topLevel.body.body)
        );
      }

      return false;
    });
  }

  private usesBuiltinError(program: ProgramNode): boolean {
    const expressionUsesBuiltinError = (expression: ExpressionNode): boolean => {
      switch (expression.kind) {
        case 'AssignmentExpression':
          return expressionUsesBuiltinError(expression.target) || expressionUsesBuiltinError(expression.value);
        case 'BinaryExpression':
          return expressionUsesBuiltinError(expression.left) || expressionUsesBuiltinError(expression.right);
        case 'BooleanLiteral':
        case 'DoubleLiteral':
        case 'IntegerLiteral':
        case 'NullLiteral':
        case 'StringLiteral':
        case 'ThisExpression':
          return false;
        case 'CallExpression':
          return (
            (expression.callee.kind === 'IdentifierExpression' &&
              expression.callee.name === BUILTIN_ERROR_CLASS_NAME) ||
            expressionUsesBuiltinError(expression.callee) ||
            expression.arguments.some(expressionUsesBuiltinError)
          );
        case 'ConditionalExpression':
          return (
            expressionUsesBuiltinError(expression.condition) ||
            expressionUsesBuiltinError(expression.thenExpression) ||
            expressionUsesBuiltinError(expression.elseExpression)
          );
        case 'GroupingExpression':
        case 'UnaryExpression':
          return expressionUsesBuiltinError(expression.expression);
        case 'IdentifierExpression':
          return false;
        case 'MemberExpression':
          return expressionUsesBuiltinError(expression.object);
      }
    };

    const statementUsesBuiltinError = (statement: StatementNode): boolean => {
      switch (statement.kind) {
        case 'BlockStatement':
          return statement.body.some(statementUsesBuiltinError);
        case 'BreakStatement':
        case 'ContinueStatement':
          return false;
        case 'DoWhileStatement':
          return statement.body.body.some(statementUsesBuiltinError) || expressionUsesBuiltinError(statement.condition);
        case 'ExpressionStatement':
          return expressionUsesBuiltinError(statement.expression);
        case 'ForStatement':
          return (
            (statement.initializer.kind === 'VariableDeclaration' &&
              (this.typeUsesBuiltinError(statement.initializer.type) ||
                expressionUsesBuiltinError(statement.initializer.initializer))) ||
            (statement.initializer.kind !== 'VariableDeclaration' &&
              expressionUsesBuiltinError(statement.initializer)) ||
            expressionUsesBuiltinError(statement.condition) ||
            expressionUsesBuiltinError(statement.update) ||
            statement.body.body.some(statementUsesBuiltinError)
          );
        case 'IfStatement':
          return (
            expressionUsesBuiltinError(statement.condition) ||
            statement.thenBranch.body.some(statementUsesBuiltinError) ||
            (statement.elseBranch?.kind === 'BlockStatement' &&
              statement.elseBranch.body.some(statementUsesBuiltinError)) ||
            (statement.elseBranch?.kind === 'IfStatement' && statementUsesBuiltinError(statement.elseBranch))
          );
        case 'ReturnStatement':
          return statement.values.some((value: ExpressionNode): boolean => expressionUsesBuiltinError(value));
        case 'MultiVariableDeclaration':
          return (
            statement.bindings.some((binding): boolean => this.typeUsesBuiltinError(binding.type)) ||
            expressionUsesBuiltinError(statement.initializer)
          );
        case 'VariableDeclaration':
          return this.typeUsesBuiltinError(statement.type) || expressionUsesBuiltinError(statement.initializer);
        case 'WhileStatement':
          return expressionUsesBuiltinError(statement.condition) || statement.body.body.some(statementUsesBuiltinError);
      }
    };

    return program.body.some((topLevel: TopLevelNode): boolean => {
      if (topLevel.kind === 'ClassDeclaration') {
        return topLevel.members.some((member): boolean => {
          if (member.kind === 'ClassFieldDeclaration') {
            return this.typeUsesBuiltinError(member.type);
          }

          return (
            member.parameters.some((parameter: FunctionParameterNode): boolean =>
              this.typeUsesBuiltinError(parameter.type)
            ) ||
            member.throws.some((thrownType: TypeNode): boolean => this.typeUsesBuiltinError(thrownType)) ||
            (member.returnType !== null && this.typeUsesBuiltinError(member.returnType)) ||
            member.body.body.some(statementUsesBuiltinError)
          );
        });
      }

      if (topLevel.kind === 'FunctionDeclaration') {
        return (
          this.typeUsesBuiltinError(topLevel.returnType) ||
          topLevel.throws.some((thrownType: TypeNode): boolean => this.typeUsesBuiltinError(thrownType)) ||
          topLevel.parameters.some((parameter: FunctionParameterNode): boolean =>
            this.typeUsesBuiltinError(parameter.type)
          ) ||
          topLevel.body.body.some(statementUsesBuiltinError)
        );
      }

      return false;
    });
  }

  private usesUnknownType(program: ProgramNode): boolean {
    const statementUsesUnknown = (statement: StatementNode): boolean => {
      switch (statement.kind) {
        case 'BlockStatement':
          return statement.body.some(statementUsesUnknown);
        case 'BreakStatement':
        case 'ContinueStatement':
          return false;
        case 'DoWhileStatement':
          return statement.body.body.some(statementUsesUnknown);
        case 'ExpressionStatement':
          return false;
        case 'ForStatement':
          return (
            (statement.initializer.kind === 'VariableDeclaration' &&
              this.typeUsesUnknown(statement.initializer.type)) ||
            statement.body.body.some(statementUsesUnknown)
          );
        case 'IfStatement':
          return (
            statement.thenBranch.body.some(statementUsesUnknown) ||
            (statement.elseBranch?.kind === 'BlockStatement' && statement.elseBranch.body.some(statementUsesUnknown)) ||
            (statement.elseBranch?.kind === 'IfStatement' && statementUsesUnknown(statement.elseBranch))
          );
        case 'MultiVariableDeclaration':
          return statement.bindings.some((binding): boolean => this.typeUsesUnknown(binding.type));
        case 'ReturnStatement':
          return false;
        case 'VariableDeclaration':
          return this.typeUsesUnknown(statement.type);
        case 'WhileStatement':
          return statement.body.body.some(statementUsesUnknown);
      }
    };

    return program.body.some((topLevel: TopLevelNode): boolean => {
      if (topLevel.kind === 'ClassDeclaration') {
        return topLevel.members.some((member): boolean => {
          if (member.kind === 'ClassFieldDeclaration') {
            return this.typeUsesUnknown(member.type);
          }

          return (
            member.throws.length > 1 ||
            member.parameters.some((parameter: FunctionParameterNode): boolean =>
              this.typeUsesUnknown(parameter.type)
            ) ||
            (member.returnType !== null && this.typeUsesUnknown(member.returnType)) ||
            member.body.body.some(statementUsesUnknown)
          );
        });
      }

      if (topLevel.kind === 'FunctionDeclaration') {
        return (
          topLevel.throws.length > 1 ||
          this.typeUsesUnknown(topLevel.returnType) ||
          topLevel.parameters.some((parameter: FunctionParameterNode): boolean =>
            this.typeUsesUnknown(parameter.type)
          ) ||
          topLevel.body.body.some(statementUsesUnknown)
        );
      }

      return false;
    });
  }

  private usesIsInstance(program: ProgramNode): boolean {
    const expressionUsesIsInstance = (expression: ExpressionNode): boolean => {
      switch (expression.kind) {
        case 'AssignmentExpression':
          return expressionUsesIsInstance(expression.target) || expressionUsesIsInstance(expression.value);
        case 'BinaryExpression':
          return expressionUsesIsInstance(expression.left) || expressionUsesIsInstance(expression.right);
        case 'BooleanLiteral':
        case 'DoubleLiteral':
        case 'IdentifierExpression':
        case 'IntegerLiteral':
        case 'NullLiteral':
        case 'StringLiteral':
        case 'ThisExpression':
          return false;
        case 'CallExpression':
          return (
            (expression.callee.kind === 'IdentifierExpression' && expression.callee.name === 'isInstance') ||
            expressionUsesIsInstance(expression.callee) ||
            expression.arguments.some(expressionUsesIsInstance)
          );
        case 'ConditionalExpression':
          return (
            expressionUsesIsInstance(expression.condition) ||
            expressionUsesIsInstance(expression.thenExpression) ||
            expressionUsesIsInstance(expression.elseExpression)
          );
        case 'GroupingExpression':
        case 'UnaryExpression':
          return expressionUsesIsInstance(expression.expression);
        case 'MemberExpression':
          return expressionUsesIsInstance(expression.object);
      }
    };

    const statementUsesIsInstance = (statement: StatementNode): boolean => {
      switch (statement.kind) {
        case 'BlockStatement':
          return statement.body.some(statementUsesIsInstance);
        case 'BreakStatement':
        case 'ContinueStatement':
          return false;
        case 'DoWhileStatement':
          return statementUsesIsInstance(statement.body) || expressionUsesIsInstance(statement.condition);
        case 'ExpressionStatement':
          return expressionUsesIsInstance(statement.expression);
        case 'ForStatement':
          return (
            (statement.initializer.kind === 'VariableDeclaration' &&
              expressionUsesIsInstance(statement.initializer.initializer)) ||
            (statement.initializer.kind !== 'VariableDeclaration' && expressionUsesIsInstance(statement.initializer)) ||
            expressionUsesIsInstance(statement.condition) ||
            expressionUsesIsInstance(statement.update) ||
            statement.body.body.some(statementUsesIsInstance)
          );
        case 'IfStatement':
          return (
            expressionUsesIsInstance(statement.condition) ||
            statement.thenBranch.body.some(statementUsesIsInstance) ||
            (statement.elseBranch?.kind === 'BlockStatement' &&
              statement.elseBranch.body.some(statementUsesIsInstance)) ||
            (statement.elseBranch?.kind === 'IfStatement' && statementUsesIsInstance(statement.elseBranch))
          );
        case 'ReturnStatement':
          return statement.values.some((value: ExpressionNode): boolean => expressionUsesIsInstance(value));
        case 'MultiVariableDeclaration':
          return expressionUsesIsInstance(statement.initializer);
        case 'VariableDeclaration':
          return expressionUsesIsInstance(statement.initializer);
        case 'WhileStatement':
          return expressionUsesIsInstance(statement.condition) || statement.body.body.some(statementUsesIsInstance);
      }
    };

    return program.body.some((topLevel: TopLevelNode): boolean => {
      if (topLevel.kind === 'ClassDeclaration') {
        return topLevel.members.some((member): boolean => {
          if (member.kind === 'ClassFieldDeclaration') {
            return false;
          }

          return member.body.body.some(statementUsesIsInstance);
        });
      }

      if (topLevel.kind === 'FunctionDeclaration') {
        return topLevel.body.body.some(statementUsesIsInstance);
      }

      return false;
    });
  }
}
