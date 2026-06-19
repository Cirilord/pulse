#include <stdbool.h>
#include <stddef.h>

typedef struct {
  size_t length;
  const char *data;
} string_t;

#define STRING_LITERAL(value) ((string_t){ sizeof(value) - 1, value })

int main(void) {
  int statusCode = 1;
  if ((statusCode == 0)) {
    const string_t label = STRING_LITERAL("zero");
  }
  else if ((statusCode == 1)) {
    const string_t label = STRING_LITERAL("one");
  }
  else {
    const string_t label = STRING_LITERAL("other");
  }
  return 0;
}
