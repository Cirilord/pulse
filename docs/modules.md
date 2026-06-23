# Modules

This document tracks the current local Pulse module rules.

## Rules

- Only relative Pulse file imports are supported for now
- Imports currently resolve only `./...` and `../...` sources
- Pulse automatically resolves `.p` when an import source omits the extension
- Builtin library imports such as `"array"` are not supported yet
- C imports such as `"c:stdio.h"` are not supported yet
- Top-level declarations can currently be `import`, `class`, `fn`, or single `val`/`var` declarations
- `export` can currently be used on top-level `class`, `fn`, `val`, and `var` declarations
- Reexports currently support `export * from "./file"` and `export { A, B } from "./file"`
- Imports currently support namespace, named, star, and mixed namespace-plus-named forms
- Imported top-level variables are lowered as generated globals in C
- Generated global initialization currently runs before the user `main(): int`

## Valid Examples

```pulse
import File1, { importedText, logImportedText, ImportedValue } from "./file1";
import * from "./extra";

fn main(): int {
  val imported: ImportedValue = File1.ImportedValue(20);
  logImportedText();

  if (importedText == "hello" && increment(imported.value + extraValue) == 23) {
    return 1;
  }

  return 0;
}
```

```pulse
export val importedText: string = "hello";

export class ImportedValue {
  public val value: int;

  public fn constructor(val value: int) {
    this.value = value;
  }
}

export fn logImportedText(): void {
  return;
}
```

```pulse
export { importedText, logImportedText, ImportedValue, createImportedValue } from "./file1";
export * from "./extra";
```
