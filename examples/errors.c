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
  string_t message;
} ParseError;

typedef struct {
  const char *pulse__type_name;
  string_t message;
} IoError;

typedef union {
  ParseError ParseError_value;
  IoError IoError_value;
} unknown_value_t;

typedef struct {
  const char *type_name;
  unknown_value_t value;
} unknown_t;

typedef struct {
  bool is_null;
  IoError value;
} IoError_nullable;

typedef struct {
  bool is_null;
  int value;
} int_nullable;

typedef struct {
  bool is_null;
  unknown_t value;
} unknown_t_nullable;

typedef struct {
  int_nullable value;
  unknown_t_nullable error;
} parse__result_t;

ParseError ParseError__constructor(const string_t message);
IoError IoError__constructor(const string_t message);
parse__result_t parse(const string_t text);
IoError_nullable save(const string_t text);
int main(void);

ParseError ParseError__constructor(const string_t message) {
  ParseError self = (ParseError){ 0 };
  self.pulse__type_name = "ParseError";
  self.message = message;
  return self;
}

IoError IoError__constructor(const string_t message) {
  IoError self = (IoError){ 0 };
  self.pulse__type_name = "IoError";
  self.message = message;
  return self;
}

parse__result_t parse(const string_t text) {
  if ((string_t_equal(text, STRING_LITERAL("")))) {
    return (parse__result_t){ .value = (int_nullable){ .is_null = true, .value = 0 }, .error = (unknown_t_nullable){ .is_null = false, .value = (unknown_t){ .type_name = "ParseError", .value.ParseError_value = ParseError__constructor(STRING_LITERAL("Empty text")) } } };
  }
  return (parse__result_t){ .value = (int_nullable){ .is_null = false, .value = 10 }, .error = (unknown_t_nullable){ .is_null = true, .value = { .type_name = NULL } } };
}

IoError_nullable save(const string_t text) {
  if ((string_t_equal(text, STRING_LITERAL("")))) {
    return (IoError_nullable){ .is_null = false, .value = IoError__constructor(STRING_LITERAL("Empty text")) };
  }
  return (IoError_nullable){ .is_null = true, .value = (IoError){ 0 } };
}

int main(void) {
  const parse__result_t pulse__result_0 = parse(STRING_LITERAL(""));
  const int_nullable value = pulse__result_0.value;
  const unknown_t_nullable err = pulse__result_0.error;
  IoError_nullable saveErr = save(STRING_LITERAL("ok"));
  if ((!saveErr.is_null)) {
    return 2;
  }
  if (((!err.is_null) && (!err.is_null && strcmp(err.value.type_name, "ParseError") == 0))) {
    return 1;
  }
  return (value.is_null ? 0 : value.value);
}

