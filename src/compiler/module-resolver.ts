import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Lexer } from '../lexer/lexer.js';
import { type TokenLocation } from '../lexer/token.js';
import type {
  AssignmentExpressionNode,
  BlockStatementNode,
  CallExpressionNode,
  ClassDeclarationNode,
  ClassFieldDeclarationNode,
  ClassMemberDeclarationNode,
  ClassMethodDeclarationNode,
  ConditionalExpressionNode,
  DeferStatementNode,
  DoWhileStatementNode,
  ExpressionNode,
  ExpressionStatementNode,
  ForStatementNode,
  FunctionDeclarationNode,
  FunctionParameterNode,
  IdentifierNode,
  IdentifierExpressionNode,
  IfStatementNode,
  ImportDeclarationNode,
  MemberExpressionNode,
  MultiVariableDeclarationNode,
  ProgramNode,
  ReturnStatementNode,
  StatementNode,
  TypeNode,
  VariableBindingNode,
  VariableDeclarationNode,
  WhileStatementNode,
} from '../parser/ast/index.js';
import { Parser } from '../parser/parser.js';

type TopLevelDeclarationNode = ClassDeclarationNode | FunctionDeclarationNode | VariableDeclarationNode;
type ExportedDeclarationKind = 'class' | 'function' | 'variable';

type ExportedDeclaration = {
  internalName: string;
  kind: ExportedDeclarationKind;
};

type ImportedBinding = ExportedDeclaration;

type ModuleRecord = {
  declarations: TopLevelDeclarationNode[];
  exports: Map<string, ExportedDeclaration>;
  imports: ImportDeclarationNode[];
  isRoot: boolean;
  localDeclarations: Map<string, ExportedDeclaration>;
  path: string;
  program: ProgramNode;
  transformedBody: TopLevelDeclarationNode[];
};

type TransformContext = {
  importedBindings: Map<string, ImportedBinding>;
  localDeclarations: Map<string, ExportedDeclaration>;
  namespaceImports: Map<string, ModuleRecord>;
  scopes: Set<string>[];
};

export class ModuleResolverError extends Error {
  public readonly location: TokenLocation | null;

  public constructor(message: string, location: TokenLocation | null = null) {
    super(message);
    this.location = location;
    this.name = 'ModuleResolverError';
  }
}

export class ModuleResolver {
  private moduleCounter: number;

  private readonly modules: Map<string, ModuleRecord>;

  private readonly resolvingPaths: string[];

  public constructor() {
    this.modules = new Map<string, ModuleRecord>();
    this.resolvingPaths = [];
    this.moduleCounter = 0;
  }

  public async resolveEntry(entryPath: string): Promise<ProgramNode> {
    this.modules.clear();
    this.resolvingPaths.length = 0;
    this.moduleCounter = 0;

    const rootPath: string = path.resolve(entryPath);
    const rootModule: ModuleRecord = await this.loadModule(rootPath, true);
    const orderedModules: ModuleRecord[] = this.getModulesInDependencyOrder(rootModule);
    const body: TopLevelDeclarationNode[] = [];

    for (const moduleRecord of orderedModules) {
      body.push(...moduleRecord.transformedBody);
    }

    return {
      body,
      kind: 'Program',
      location: rootModule.program.location,
    };
  }

  private addScope(context: TransformContext): void {
    context.scopes.push(new Set<string>());
  }

  private cloneIdentifier(node: IdentifierNode, name: string = node.name): IdentifierNode {
    return {
      kind: 'Identifier',
      location: node.location,
      name,
    };
  }

  private cloneNamedType(name: string, location: TokenLocation): TypeNode & { kind: 'NamedType' } {
    return {
      kind: 'NamedType',
      location,
      name,
    };
  }

  private createExportMap(
    moduleRecord: ModuleRecord,
    declarations: TopLevelDeclarationNode[]
  ): Map<string, ExportedDeclaration> {
    const exportsMap: Map<string, ExportedDeclaration> = new Map<string, ExportedDeclaration>();

    for (const declaration of declarations) {
      if (!declaration.isExported) {
        continue;
      }

      const declarationName: string = declaration.name.name;
      const localDeclaration: ExportedDeclaration | undefined = moduleRecord.localDeclarations.get(declarationName);

      if (localDeclaration === undefined) {
        throw new Error(`Missing local declaration "${declarationName}" during export resolution.`);
      }

      this.registerExport(exportsMap, declarationName, localDeclaration, declaration.location);
    }

    for (const importDeclaration of moduleRecord.imports) {
      if (!importDeclaration.isExported) {
        continue;
      }

      const dependencyPath: string = this.resolveImportSource(moduleRecord.path, importDeclaration);
      const dependencyModule: ModuleRecord | undefined = this.modules.get(dependencyPath);

      if (dependencyModule === undefined) {
        throw new Error(`Missing dependency module "${dependencyPath}" during export resolution.`);
      }

      if (importDeclaration.importAll) {
        for (const [exportName, exportedDeclaration] of dependencyModule.exports) {
          this.registerExport(exportsMap, exportName, exportedDeclaration, importDeclaration.location);
        }

        continue;
      }

      for (const namedImport of importDeclaration.namedImports) {
        const exportedDeclaration: ExportedDeclaration | undefined = dependencyModule.exports.get(namedImport.name);

        if (exportedDeclaration === undefined) {
          throw new ModuleResolverError(
            `Module "${importDeclaration.source}" does not export "${namedImport.name}".`,
            namedImport.location
          );
        }

        this.registerExport(exportsMap, namedImport.name, exportedDeclaration, namedImport.location);
      }
    }

    return exportsMap;
  }

  private createIdentifierExpression(location: TokenLocation, name: string): IdentifierExpressionNode {
    return {
      kind: 'IdentifierExpression',
      location,
      name,
    };
  }

  private createLocalDeclarationMap(
    declarations: TopLevelDeclarationNode[],
    isRoot: boolean
  ): Map<string, ExportedDeclaration> {
    const declarationMap: Map<string, ExportedDeclaration> = new Map<string, ExportedDeclaration>();

    for (const declaration of declarations) {
      if (declarationMap.has(declaration.name.name)) {
        throw new ModuleResolverError(
          `Top-level declaration "${declaration.name.name}" is already declared.`,
          declaration.name.location
        );
      }

      const internalName: string = isRoot
        ? declaration.name.name
        : `pulse__module_${this.moduleCounter}__${declaration.name.name}`;

      declarationMap.set(declaration.name.name, {
        internalName,
        kind: this.getDeclarationKind(declaration),
      });
    }

    if (!isRoot) {
      this.moduleCounter += 1;
    }

    return declarationMap;
  }

  private getDeclarationKind(declaration: TopLevelDeclarationNode): ExportedDeclarationKind {
    switch (declaration.kind) {
      case 'ClassDeclaration':
        return 'class';
      case 'FunctionDeclaration':
        return 'function';
      case 'VariableDeclaration':
        return 'variable';
    }
  }

  private getModulesInDependencyOrder(rootModule: ModuleRecord): ModuleRecord[] {
    const orderedModules: ModuleRecord[] = [];
    const visitedPaths: Set<string> = new Set<string>();

    const visitModule = (moduleRecord: ModuleRecord): void => {
      if (visitedPaths.has(moduleRecord.path)) {
        return;
      }

      visitedPaths.add(moduleRecord.path);

      for (const importDeclaration of moduleRecord.imports) {
        const dependencyPath: string = this.resolveImportSource(moduleRecord.path, importDeclaration);
        const dependencyModule: ModuleRecord = this.modules.get(dependencyPath)!;
        visitModule(dependencyModule);
      }

      orderedModules.push(moduleRecord);
    };

    visitModule(rootModule);

    return orderedModules;
  }

  private isScopedName(context: TransformContext, name: string): boolean {
    for (let index: number = context.scopes.length - 1; index >= 0; index -= 1) {
      if (context.scopes[index]?.has(name)) {
        return true;
      }
    }

    return false;
  }

  private async loadModule(modulePath: string, isRoot: boolean): Promise<ModuleRecord> {
    const normalizedPath: string = this.normalizeModulePath(modulePath);
    const cachedModule: ModuleRecord | undefined = this.modules.get(normalizedPath);

    if (cachedModule !== undefined) {
      if (isRoot) {
        cachedModule.isRoot = true;
      }

      return cachedModule;
    }

    if (this.resolvingPaths.includes(normalizedPath)) {
      throw new ModuleResolverError(
        `Circular module import detected: ${[...this.resolvingPaths, normalizedPath].join(' -> ')}.`
      );
    }

    this.resolvingPaths.push(normalizedPath);

    try {
      const sourceCode: string = await readFile(normalizedPath, 'utf8');
      const parser: Parser = new Parser(new Lexer(sourceCode).tokenize());
      const program: ProgramNode = parser.parseProgram();
      const imports: ImportDeclarationNode[] = [];
      const declarations: TopLevelDeclarationNode[] = [];

      for (const topLevel of program.body) {
        if (topLevel.kind === 'ImportDeclaration') {
          imports.push(topLevel);
          continue;
        }

        if (
          topLevel.kind === 'ClassDeclaration' ||
          topLevel.kind === 'FunctionDeclaration' ||
          topLevel.kind === 'VariableDeclaration'
        ) {
          declarations.push(topLevel);
          continue;
        }

        throw new ModuleResolverError(
          'Only imports, functions, classes, and variable declarations are allowed at the top level.'
        );
      }

      const localDeclarations: Map<string, ExportedDeclaration> = this.createLocalDeclarationMap(declarations, isRoot);
      const moduleRecord: ModuleRecord = {
        declarations,
        exports: new Map<string, ExportedDeclaration>(),
        imports,
        isRoot,
        localDeclarations,
        path: normalizedPath,
        program,
        transformedBody: [],
      };

      this.modules.set(normalizedPath, moduleRecord);

      for (const importDeclaration of imports) {
        const dependencyPath: string = this.resolveImportSource(normalizedPath, importDeclaration);
        await this.loadModule(dependencyPath, false);
      }

      moduleRecord.exports = this.createExportMap(moduleRecord, declarations);
      moduleRecord.transformedBody = this.transformModule(moduleRecord);

      return moduleRecord;
    } finally {
      this.resolvingPaths.pop();
    }
  }

  private normalizeModulePath(modulePath: string): string {
    return modulePath.endsWith('.p') ? modulePath : `${modulePath}.p`;
  }

  private popScope(context: TransformContext): void {
    context.scopes.pop();
  }

  private pushLocalName(context: TransformContext, name: string): void {
    context.scopes[context.scopes.length - 1]?.add(name);
  }

  private registerExport(
    exportsMap: Map<string, ExportedDeclaration>,
    name: string,
    exportedDeclaration: ExportedDeclaration,
    location: TokenLocation
  ): void {
    if (exportsMap.has(name)) {
      throw new ModuleResolverError(`Export "${name}" is already declared.`, location);
    }

    exportsMap.set(name, exportedDeclaration);
  }

  private registerImportedBinding(
    moduleRecord: ModuleRecord,
    importedBindings: Map<string, ImportedBinding>,
    namespaceImports: Map<string, ModuleRecord>,
    importDeclaration: ImportDeclarationNode,
    name: string,
    exportedDeclaration: ExportedDeclaration
  ): void {
    if (importedBindings.has(name) || namespaceImports.has(name) || moduleRecord.localDeclarations.has(name)) {
      throw new ModuleResolverError(`Imported name "${name}" is already declared.`, importDeclaration.location);
    }

    importedBindings.set(name, exportedDeclaration);
  }

  private renameTopLevelIdentifier(identifier: IdentifierNode, context: TransformContext): IdentifierNode {
    const declaration: ExportedDeclaration | undefined = context.localDeclarations.get(identifier.name);

    if (declaration === undefined) {
      throw new Error(`Missing top-level declaration "${identifier.name}" during module transform.`);
    }

    return this.cloneIdentifier(identifier, declaration.internalName);
  }

  private resolveImportSource(modulePath: string, importDeclaration: ImportDeclarationNode): string {
    if (!importDeclaration.source.startsWith('./') && !importDeclaration.source.startsWith('../')) {
      throw new ModuleResolverError(
        `Only relative Pulse imports are supported for now, got "${importDeclaration.source}".`,
        importDeclaration.location
      );
    }

    return this.normalizeModulePath(path.resolve(path.dirname(modulePath), importDeclaration.source));
  }

  private resolveImportedBindings(moduleRecord: ModuleRecord): {
    importedBindings: Map<string, ImportedBinding>;
    namespaceImports: Map<string, ModuleRecord>;
  } {
    const importedBindings: Map<string, ImportedBinding> = new Map<string, ImportedBinding>();
    const namespaceImports: Map<string, ModuleRecord> = new Map<string, ModuleRecord>();

    for (const importDeclaration of moduleRecord.imports) {
      if (importDeclaration.isExported) {
        continue;
      }

      const dependencyPath: string = this.resolveImportSource(moduleRecord.path, importDeclaration);
      const dependencyModule: ModuleRecord | undefined = this.modules.get(dependencyPath);

      if (dependencyModule === undefined) {
        throw new Error(`Missing dependency module "${dependencyPath}".`);
      }

      if (importDeclaration.namespaceImport !== null) {
        if (
          importedBindings.has(importDeclaration.namespaceImport.name) ||
          namespaceImports.has(importDeclaration.namespaceImport.name) ||
          moduleRecord.localDeclarations.has(importDeclaration.namespaceImport.name)
        ) {
          throw new ModuleResolverError(
            `Imported name "${importDeclaration.namespaceImport.name}" is already declared.`,
            importDeclaration.namespaceImport.location
          );
        }

        namespaceImports.set(importDeclaration.namespaceImport.name, dependencyModule);
      }

      if (importDeclaration.importAll) {
        for (const [exportName, exportedDeclaration] of dependencyModule.exports) {
          this.registerImportedBinding(
            moduleRecord,
            importedBindings,
            namespaceImports,
            importDeclaration,
            exportName,
            exportedDeclaration
          );
        }
      }

      for (const namedImport of importDeclaration.namedImports) {
        const exportedDeclaration: ExportedDeclaration | undefined = dependencyModule.exports.get(namedImport.name);

        if (exportedDeclaration === undefined) {
          throw new ModuleResolverError(
            `Module "${importDeclaration.source}" does not export "${namedImport.name}".`,
            namedImport.location
          );
        }

        this.registerImportedBinding(
          moduleRecord,
          importedBindings,
          namespaceImports,
          importDeclaration,
          namedImport.name,
          exportedDeclaration
        );
      }
    }

    return {
      importedBindings,
      namespaceImports,
    };
  }

  private transformAssignmentTarget(
    target: AssignmentExpressionNode['target'],
    context: TransformContext
  ): IdentifierExpressionNode | MemberExpressionNode {
    if (target.kind === 'IdentifierExpression') {
      return this.transformIdentifierExpression(target, context);
    }

    const transformedTarget: ExpressionNode = this.transformMemberExpression(target, context);

    if (transformedTarget.kind !== 'MemberExpression' && transformedTarget.kind !== 'IdentifierExpression') {
      throw new ModuleResolverError('Invalid assignment target after import resolution.', target.location);
    }

    return transformedTarget;
  }

  private transformBlockStatement(statement: BlockStatementNode, context: TransformContext): BlockStatementNode {
    this.addScope(context);
    const transformedBody: StatementNode[] = statement.body.map(
      (innerStatement: StatementNode): StatementNode => this.transformStatement(innerStatement, context)
    );
    this.popScope(context);

    return {
      ...statement,
      body: transformedBody,
    };
  }

  private transformClassDeclaration(
    declaration: ClassDeclarationNode,
    context: TransformContext
  ): ClassDeclarationNode {
    this.addScope(context);
    const transformedMembers: ClassMemberDeclarationNode[] = declaration.members.map(
      (member: ClassMemberDeclarationNode): ClassMemberDeclarationNode => {
        if (member.kind === 'ClassFieldDeclaration') {
          return this.transformClassFieldDeclaration(member, context);
        }

        return this.transformClassMethodDeclaration(member, context);
      }
    );
    this.popScope(context);

    return {
      ...declaration,
      baseName: declaration.baseName === null ? null : this.transformTypeNameIdentifier(declaration.baseName, context),
      members: transformedMembers,
      name: this.renameTopLevelIdentifier(declaration.name, context),
    };
  }

  private transformClassFieldDeclaration(
    declaration: ClassFieldDeclarationNode,
    context: TransformContext
  ): ClassFieldDeclarationNode {
    return {
      ...declaration,
      type: this.transformTypeNode(declaration.type, context),
    };
  }

  private transformClassMethodDeclaration(
    declaration: ClassMethodDeclarationNode,
    context: TransformContext
  ): ClassMethodDeclarationNode {
    this.addScope(context);

    const transformedParameters: FunctionParameterNode[] = declaration.parameters.map(
      (parameter: FunctionParameterNode) => {
        this.pushLocalName(context, parameter.name.name);

        return {
          ...parameter,
          type: this.transformTypeNode(parameter.type, context),
        };
      }
    );

    const transformedBody: BlockStatementNode = this.transformBlockStatement(declaration.body, context);
    this.popScope(context);

    return {
      ...declaration,
      body: transformedBody,
      parameters: transformedParameters,
      returnType: declaration.returnType === null ? null : this.transformTypeNode(declaration.returnType, context),
      throws: declaration.throws.map((typeNode: TypeNode): TypeNode => this.transformTypeNode(typeNode, context)),
    };
  }

  private transformDeferStatement(statement: DeferStatementNode, context: TransformContext): DeferStatementNode {
    return {
      ...statement,
      expression: this.transformExpression(statement.expression, context),
    };
  }

  private transformDoWhileStatement(statement: DoWhileStatementNode, context: TransformContext): DoWhileStatementNode {
    return {
      ...statement,
      body: this.transformBlockStatement(statement.body, context),
      condition: this.transformExpression(statement.condition, context),
    };
  }

  private transformExpression(expression: ExpressionNode, context: TransformContext): ExpressionNode {
    switch (expression.kind) {
      case 'AssignmentExpression':
        return {
          ...expression,
          target: this.transformAssignmentTarget(expression.target, context),
          value: this.transformExpression(expression.value, context),
        } satisfies AssignmentExpressionNode;
      case 'BinaryExpression':
        return {
          ...expression,
          left: this.transformExpression(expression.left, context),
          right: this.transformExpression(expression.right, context),
        };
      case 'BooleanLiteral':
      case 'DoubleLiteral':
      case 'IntegerLiteral':
      case 'NullLiteral':
      case 'StringLiteral':
      case 'SuperExpression':
      case 'ThisExpression':
        return expression;
      case 'CallExpression':
        return {
          ...expression,
          arguments: expression.arguments.map(
            (argument: ExpressionNode): ExpressionNode => this.transformExpression(argument, context)
          ),
          callee: this.transformExpression(expression.callee, context),
        } satisfies CallExpressionNode;
      case 'ConditionalExpression':
        return {
          ...expression,
          condition: this.transformExpression(expression.condition, context),
          elseExpression: this.transformExpression(expression.elseExpression, context),
          thenExpression: this.transformExpression(expression.thenExpression, context),
        } satisfies ConditionalExpressionNode;
      case 'GroupingExpression':
        return {
          ...expression,
          expression: this.transformExpression(expression.expression, context),
        };
      case 'IdentifierExpression':
        return this.transformIdentifierExpression(expression, context);
      case 'MemberExpression':
        return this.transformMemberExpression(expression, context);
      case 'UnaryExpression':
        return {
          ...expression,
          expression: this.transformExpression(expression.expression, context),
        };
    }
  }

  private transformExpressionStatement(
    statement: ExpressionStatementNode,
    context: TransformContext
  ): ExpressionStatementNode {
    return {
      ...statement,
      expression: this.transformExpression(statement.expression, context),
    };
  }

  private transformForStatement(statement: ForStatementNode, context: TransformContext): ForStatementNode {
    this.addScope(context);
    const transformedInitializer =
      statement.initializer.kind === 'VariableDeclaration'
        ? this.transformVariableDeclaration(statement.initializer, context, false)
        : this.transformExpression(statement.initializer, context);
    const transformedBody: BlockStatementNode = this.transformBlockStatement(statement.body, context);
    const transformedUpdate: ExpressionNode = this.transformExpression(statement.update, context);
    const transformedCondition: ExpressionNode = this.transformExpression(statement.condition, context);
    this.popScope(context);

    return {
      ...statement,
      body: transformedBody,
      condition: transformedCondition,
      initializer: transformedInitializer,
      update: transformedUpdate,
    };
  }

  private transformFunctionDeclaration(
    declaration: FunctionDeclarationNode,
    context: TransformContext
  ): FunctionDeclarationNode {
    this.addScope(context);

    const transformedParameters: FunctionParameterNode[] = declaration.parameters.map(
      (parameter: FunctionParameterNode) => {
        this.pushLocalName(context, parameter.name.name);

        return {
          ...parameter,
          type: this.transformTypeNode(parameter.type, context),
        };
      }
    );

    const transformedBody: BlockStatementNode = this.transformBlockStatement(declaration.body, context);
    this.popScope(context);

    return {
      ...declaration,
      body: transformedBody,
      name: this.renameTopLevelIdentifier(declaration.name, context),
      parameters: transformedParameters,
      returnType: this.transformTypeNode(declaration.returnType, context),
      throws: declaration.throws.map((typeNode: TypeNode): TypeNode => this.transformTypeNode(typeNode, context)),
    };
  }

  private transformIdentifierExpression(
    expression: IdentifierExpressionNode,
    context: TransformContext
  ): IdentifierExpressionNode {
    if (this.isScopedName(context, expression.name)) {
      return expression;
    }

    const localDeclaration: ExportedDeclaration | undefined = context.localDeclarations.get(expression.name);

    if (localDeclaration !== undefined) {
      return this.createIdentifierExpression(expression.location, localDeclaration.internalName);
    }

    const importedBinding: ImportedBinding | undefined = context.importedBindings.get(expression.name);

    if (importedBinding !== undefined) {
      return this.createIdentifierExpression(expression.location, importedBinding.internalName);
    }

    return expression;
  }

  private transformIfStatement(statement: IfStatementNode, context: TransformContext): IfStatementNode {
    return {
      ...statement,
      condition: this.transformExpression(statement.condition, context),
      elseBranch:
        statement.elseBranch === null
          ? null
          : statement.elseBranch.kind === 'BlockStatement'
            ? this.transformBlockStatement(statement.elseBranch, context)
            : this.transformIfStatement(statement.elseBranch, context),
      thenBranch: this.transformBlockStatement(statement.thenBranch, context),
    };
  }

  private transformMemberExpression(expression: MemberExpressionNode, context: TransformContext): ExpressionNode {
    if (expression.object.kind === 'IdentifierExpression' && context.namespaceImports.has(expression.object.name)) {
      const moduleRecord: ModuleRecord = context.namespaceImports.get(expression.object.name)!;
      const exportedDeclaration: ExportedDeclaration | undefined = moduleRecord.exports.get(expression.property.name);

      if (exportedDeclaration === undefined) {
        throw new ModuleResolverError(
          `Module "${path.basename(moduleRecord.path)}" does not export "${expression.property.name}".`,
          expression.property.location
        );
      }

      return this.createIdentifierExpression(expression.location, exportedDeclaration.internalName);
    }

    return {
      ...expression,
      object: this.transformExpression(expression.object, context),
    };
  }

  private transformModule(moduleRecord: ModuleRecord): TopLevelDeclarationNode[] {
    const { importedBindings, namespaceImports } = this.resolveImportedBindings(moduleRecord);
    const context: TransformContext = {
      importedBindings,
      localDeclarations: moduleRecord.localDeclarations,
      namespaceImports,
      scopes: [],
    };

    return moduleRecord.declarations.map(
      (declaration: TopLevelDeclarationNode): TopLevelDeclarationNode =>
        this.transformTopLevelDeclaration(declaration, context)
    );
  }

  private transformMultiVariableDeclaration(
    declaration: MultiVariableDeclarationNode,
    context: TransformContext
  ): MultiVariableDeclarationNode {
    const transformedBindings: VariableBindingNode[] = declaration.bindings.map((binding: VariableBindingNode) =>
      this.transformVariableBinding(binding, context)
    );

    return {
      ...declaration,
      bindings: transformedBindings,
      initializer: this.transformExpression(declaration.initializer, context),
    };
  }

  private transformReturnStatement(statement: ReturnStatementNode, context: TransformContext): ReturnStatementNode {
    return {
      ...statement,
      values: statement.values.map((value: ExpressionNode): ExpressionNode => this.transformExpression(value, context)),
    };
  }

  private transformStatement(statement: StatementNode, context: TransformContext): StatementNode {
    switch (statement.kind) {
      case 'BlockStatement':
        return this.transformBlockStatement(statement, context);
      case 'BreakStatement':
      case 'ContinueStatement':
        return statement;
      case 'DeferStatement':
        return this.transformDeferStatement(statement, context);
      case 'DoWhileStatement':
        return this.transformDoWhileStatement(statement, context);
      case 'ExpressionStatement':
        return this.transformExpressionStatement(statement, context);
      case 'ForStatement':
        return this.transformForStatement(statement, context);
      case 'IfStatement':
        return this.transformIfStatement(statement, context);
      case 'MultiVariableDeclaration':
        return this.transformMultiVariableDeclaration(statement, context);
      case 'ReturnStatement':
        return this.transformReturnStatement(statement, context);
      case 'VariableDeclaration':
        return this.transformVariableDeclaration(statement, context, false);
      case 'WhileStatement':
        return this.transformWhileStatement(statement, context);
    }
  }

  private transformTopLevelDeclaration(
    declaration: TopLevelDeclarationNode,
    context: TransformContext
  ): TopLevelDeclarationNode {
    if (declaration.kind === 'ClassDeclaration') {
      return this.transformClassDeclaration(declaration, context);
    }

    if (declaration.kind === 'FunctionDeclaration') {
      return this.transformFunctionDeclaration(declaration, context);
    }

    return this.transformVariableDeclaration(declaration, context, true);
  }

  private transformTypeNameIdentifier(identifier: IdentifierNode, context: TransformContext): IdentifierNode {
    const localDeclaration: ExportedDeclaration | undefined = context.localDeclarations.get(identifier.name);

    if (localDeclaration?.kind === 'class') {
      return this.cloneIdentifier(identifier, localDeclaration.internalName);
    }

    const importedBinding: ImportedBinding | undefined = context.importedBindings.get(identifier.name);

    if (importedBinding?.kind === 'class') {
      return this.cloneIdentifier(identifier, importedBinding.internalName);
    }

    return identifier;
  }

  private transformTypeNode(typeNode: TypeNode, context: TransformContext): TypeNode {
    if (typeNode.kind === 'NullableType') {
      return {
        ...typeNode,
        type: this.transformTypeNode(typeNode.type, context) as TypeNode & { kind: 'NamedType' },
      };
    }

    return this.cloneNamedType(
      this.transformTypeNameIdentifier(
        {
          kind: 'Identifier',
          location: typeNode.location,
          name: typeNode.name,
        },
        context
      ).name,
      typeNode.location
    );
  }

  private transformVariableBinding(binding: VariableBindingNode, context: TransformContext): VariableBindingNode {
    this.pushLocalName(context, binding.name.name);

    return {
      ...binding,
      type: this.transformTypeNode(binding.type, context),
    };
  }

  private transformVariableDeclaration(
    declaration: VariableDeclarationNode,
    context: TransformContext,
    isTopLevel: boolean
  ): VariableDeclarationNode {
    if (!isTopLevel) {
      this.pushLocalName(context, declaration.name.name);
    }

    return {
      ...declaration,
      initializer: this.transformExpression(declaration.initializer, context),
      name: isTopLevel ? this.renameTopLevelIdentifier(declaration.name, context) : declaration.name,
      type: this.transformTypeNode(declaration.type, context),
    };
  }

  private transformWhileStatement(statement: WhileStatementNode, context: TransformContext): WhileStatementNode {
    return {
      ...statement,
      body: this.transformBlockStatement(statement.body, context),
      condition: this.transformExpression(statement.condition, context),
    };
  }
}
