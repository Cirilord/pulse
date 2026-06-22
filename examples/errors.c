#include <stdbool.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
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
  string_t message;
} Error;

void pulse__runtime__handle_error(const Error error) {
  fprintf(stderr, "%.*s\n", (int)error.message.length, error.message.data);
  exit(EXIT_FAILURE);
}

Error Error__constructor(const string_t message);
Error buildError(void);
int main(void);

Error Error__constructor(const string_t message) {
  Error self = (Error){ 0 };
  self.pulse__type_name = "Error";
  self.message = message;
  return self;
}

Error buildError(void) {
  return Error__constructor(STRING_LITERAL("Invalid age"));
}

int main(void) {
  Error error = buildError();
  if ((string_t_equal(error.message, STRING_LITERAL("Invalid age")))) {
    return 1;
  }
  return 0;
}

