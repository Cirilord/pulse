#include <stdbool.h>
#include <stddef.h>

typedef struct {
  size_t length;
  const char *data;
} string_t;

#define STRING_LITERAL(value) ((string_t){ sizeof(value) - 1, value })

typedef struct {
  const char *pulse__type_name;
} object_t;

typedef struct {
  object_t super;
  int value;
} ImportedValue;

const string_t ImportedValue__static_arg__name = STRING_LITERAL("ImportedValue");

string_t importedText = (string_t){ .length = 0, .data = NULL };

static void pulse__init_globals(void) {
  importedText = STRING_LITERAL("hello");
}

ImportedValue ImportedValue__constructor(const int value);
string_t ImportedValue__static_method__toString(void);
ImportedValue createImportedValue(void);
void logImportedText(void);

ImportedValue ImportedValue__constructor(const int value) {
  ImportedValue self = (ImportedValue){ 0 };
  self.super.pulse__type_name = "ImportedValue";
  self.value = value;
  return self;
}

string_t ImportedValue__static_method__toString(void) {
  return STRING_LITERAL("class ImportedValue {\n  public val value: int;\n  public fn constructor(val value: int);\n}");
}

ImportedValue createImportedValue(void) {
  return ImportedValue__constructor(20);
}

void logImportedText(void) {
  return;
}

