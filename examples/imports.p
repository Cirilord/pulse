import File1, { importedText, logImportedText, ImportedValue } from "./imports-file1";
import { createImportedValue, extraValue, increment } from "./imports-barrel";

fn main(): int {
  val imported: ImportedValue = File1.ImportedValue(20);
  val created: ImportedValue = createImportedValue();
  logImportedText();

  if (importedText == "hello" && File1.importedText == "hello" && increment(imported.value + created.value + extraValue) == 43) {
    return 1;
  }

  return 0;
}
