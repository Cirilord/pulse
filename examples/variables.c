#include <stdbool.h>
#include <stddef.h>

typedef struct {
  size_t length;
  const char *data;
} string_t;

#define STRING_LITERAL(value) ((string_t){ sizeof(value) - 1, value })

int main(void) {
  int a = 30;
  const string_t b = STRING_LITERAL("Test");
  unsigned char c = 255;
  const double d = 42.5;
  bool e = true;
  const float f = 12.25f;
  const char g = 'Z';
  return 0;
}
