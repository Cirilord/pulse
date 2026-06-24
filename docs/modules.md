# Modules

This document tracks the current local Pulse module rules.

## Rules

- Only relative Pulse file imports are supported for now
- Cataloged C imports are supported with `from "c:..."`
- Manual C bindings are supported with `import ... from "c:..." extern { ... }`
- Imports currently resolve only `./...` and `../...` sources
- Pulse automatically resolves `.p` when an import source omits the extension
- Builtin library imports such as `"array"` are not supported yet
- Cataloged C imports currently support named imports, namespace imports, and mixed namespace-plus-named imports only
- Cataloged C imports currently do not support `import *` yet
- Cataloged C modules are supported for now, and manual `extern` bindings can target any `"c:..."` header path
- Reexporting C modules is not supported yet
- Manual `extern` C imports currently support namespace imports and `import *` only
- Manual `extern` C imports currently allow `fn` and top-level `val`/`var` declarations inside the extern block
- Manual `extern` C imports currently require a `"c:..."` source
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

```pulse
import CStd, { abs } from "c:stdlib.h";

fn main(): int {
  val direct: int = abs(-10);
  val namespaced: int = CStd.abs(-20);

  if (direct == 10 && namespaced == 20) {
    return 1;
  }

  return 0;
}
```

```pulse
import CLib from "c:stdlib.h" extern {
  fn abs(val value: int): int;
}

import Unix from "c:unistd.h" extern {
  var optind: int;
}

fn main(): int {
  val direct: int = CLib.abs(-10);
  val optionIndex: int = Unix.optind;

  if (direct == 10 && optionIndex >= 0) {
    return 1;
  }

  return 0;
}
```
