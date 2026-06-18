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
  bool enabled = false;
  enabled = (enabled || true);
  enabled = (enabled && false);
  const int ternaryValue = (true ? 1 : 2);
  string_t_nullable missingAlias = (string_t_nullable){ .is_null = true, .value = (string_t){ .length = 0, .data = NULL } };
  const bool aliasIsMissing = (missingAlias.is_null);
  const bool aliasIsPresent = (!missingAlias.is_null);
  string_t_nullable otherAlias = (string_t_nullable){ .is_null = true, .value = (string_t){ .length = 0, .data = NULL } };
  const bool aliasesMatch = (missingAlias.is_null ? otherAlias.is_null : (!otherAlias.is_null && string_t_equal(missingAlias.value, otherAlias.value)));
  const bool aliasesDiffer = (!(missingAlias.is_null ? otherAlias.is_null : (!otherAlias.is_null && string_t_equal(missingAlias.value, otherAlias.value))));
  string_t_nullable alias = (string_t_nullable){ .is_null = true, .value = (string_t){ .length = 0, .data = NULL } };
  alias = (alias.is_null ? (string_t_nullable){ .is_null = false, .value = STRING_LITERAL("guest") } : alias);
  const string_t fallbackAlias = (alias.is_null ? STRING_LITERAL("guest") : alias.value);
  return 0;
}
