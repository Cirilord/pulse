export val importedText: string = "hello";

export class ImportedValue {
  public val value: int;

  public fn constructor(val value: int) {
    this.value = value;
  }
}

export fn createImportedValue(): ImportedValue {
  return ImportedValue(20);
}

export fn logImportedText(): void {
  return;
}
