#include <stdbool.h>
#include <stddef.h>

typedef struct {
  size_t length;
  const char *data;
} string_t;

#define STRING_LITERAL(value) ((string_t){ sizeof(value) - 1, value })

typedef struct {
  bool is_null;
  string_t value;
} string_t_nullable;

int main(void) {
  const bool equalCheck = (3 == 3);
  const bool notEqualCheck = (3 != 4);
  const bool lessCheck = (2 < 3);
  const bool lessOrEqualCheck = (3 <= 3);
  const bool greaterCheck = (4 > 3);
  const bool greaterOrEqualCheck = (4 >= 4);
  const bool andCheck = (true && false);
  const bool orCheck = (true || false);
  const bool unaryNot = (!false);
  const int unaryMinus = ((-5) + 2);
  const int unaryPlus = (+5);
  string_t_nullable alias = (string_t_nullable){ .is_null = true, .value = (string_t){ .length = 0, .data = NULL } };
  const string_t fallbackAlias = (alias.is_null ? STRING_LITERAL("guest") : alias.value);
  return 0;
}
