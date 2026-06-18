#include <stdbool.h>
#include <stddef.h>

typedef struct {
  size_t length;
  const char *data;
} string_t;

#define STRING_LITERAL(value) ((string_t){ sizeof(value) - 1, value })

typedef struct {
  bool is_null;
  float value;
} float_nullable;

typedef struct {
  bool is_null;
  int value;
} int_nullable;

typedef struct {
  bool is_null;
  string_t value;
} string_t_nullable;

int main(void) {
  int a = 30;
  const string_t b = STRING_LITERAL("Test");
  unsigned char c = 255;
  const double d = 42.5;
  bool e = true;
  const float f = 12.25f;
  const char g = 'Z';
  string_t_nullable nickname = (string_t_nullable){ .is_null = true, .value = (string_t){ .length = 0, .data = NULL } };
  int_nullable score = (int_nullable){ .is_null = true, .value = 0 };
  const float_nullable ratio = (float_nullable){ .is_null = true, .value = 0.0f };
  return 0;
}
