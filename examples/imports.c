#include <stdbool.h>
#include <stddef.h>
#include <string.h>

typedef struct {
  size_t length;
  const char *data;
} string_t;

#define STRING_LITERAL(value) ((string_t){ sizeof(value) - 1, value })

static bool string_t_equal(const string_t left, const string_t right) {
  if (left.length != right.length) {
    return false;
  }

  if (left.length == 0) {
    return true;
  }

  return memcmp(left.data, right.data, left.length) == 0;
}

typedef struct {
  const char *pulse__type_name;
} object_t;

typedef struct {
  object_t super;
  int value;
} pulse__module_0__ImportedValue;

const string_t pulse__module_0__ImportedValue__static_arg__name = STRING_LITERAL("ImportedValue");

string_t pulse__module_0__importedText = (string_t){ .length = 0, .data = NULL };
int pulse__module_2__extraValue = 0;

static void pulse__init_globals(void) {
  pulse__module_0__importedText = STRING_LITERAL("hello");
  pulse__module_2__extraValue = 2;
}

pulse__module_0__ImportedValue pulse__module_0__ImportedValue__constructor(const int value);
string_t pulse__module_0__ImportedValue__static_method__toString(void);
pulse__module_0__ImportedValue pulse__module_0__createImportedValue(void);
void pulse__module_0__logImportedText(void);
int pulse__module_2__increment(const int value);
int pulse__user__main(void);

pulse__module_0__ImportedValue pulse__module_0__ImportedValue__constructor(const int value) {
  pulse__module_0__ImportedValue self = (pulse__module_0__ImportedValue){ 0 };
  self.super.pulse__type_name = "pulse__module_0__ImportedValue";
  self.value = value;
  return self;
}

string_t pulse__module_0__ImportedValue__static_method__toString(void) {
  return STRING_LITERAL("class ImportedValue {\n  public val value: int;\n  public fn constructor(val value: int);\n}");
}

pulse__module_0__ImportedValue pulse__module_0__createImportedValue(void) {
  return pulse__module_0__ImportedValue__constructor(20);
}

void pulse__module_0__logImportedText(void) {
  return;
}

int pulse__module_2__increment(const int value) {
  return (value + 1);
}

int pulse__user__main(void) {
  pulse__module_0__ImportedValue imported = pulse__module_0__ImportedValue__constructor(20);
  pulse__module_0__ImportedValue created = pulse__module_0__createImportedValue();
  pulse__module_0__logImportedText();
  if ((((string_t_equal(pulse__module_0__importedText, STRING_LITERAL("hello"))) && (string_t_equal(pulse__module_0__importedText, STRING_LITERAL("hello")))) && (pulse__module_2__increment(((imported.value + created.value) + pulse__module_2__extraValue)) == 43))) {
    return 1;
  }
  return 0;
}

int main(void) {
  pulse__init_globals();
  return pulse__user__main();
}

