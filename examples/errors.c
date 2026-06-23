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
} object_t;

typedef struct {
  object_t super;
  string_t message;
} Error;

typedef struct {
  Error super;
} ParseError;

typedef struct {
  Error super;
} IoError;

const string_t Error__static_arg__name = STRING_LITERAL("Error");

const string_t ParseError__static_arg__name = STRING_LITERAL("ParseError");

const string_t IoError__static_arg__name = STRING_LITERAL("IoError");

typedef union {
  Error Error_value;
  ParseError ParseError_value;
  IoError IoError_value;
} unknown_value_t;

typedef struct {
  const char *type_name;
  unknown_value_t value;
} unknown_t;

void pulse__runtime__handle_error(const Error error) {
  fprintf(stderr, "%.*s\n", (int)error.message.length, error.message.data);
  exit(EXIT_FAILURE);
}

typedef struct {
  bool is_null;
  IoError value;
} IoError_nullable;

typedef struct {
  bool is_null;
  int value;
} int_t_nullable;

typedef struct {
  bool is_null;
  unknown_t value;
} unknown_t_nullable;

typedef struct {
  int_t_nullable value;
  unknown_t_nullable error;
} parse__result_t;

Error Error__constructor(const string_t message);
string_t Error__static_method__toString(void);
ParseError ParseError__constructor(const string_t message);
string_t ParseError__static_method__toString(void);
IoError IoError__constructor(const string_t message);
string_t IoError__static_method__toString(void);
parse__result_t parse(const string_t text);
IoError_nullable save(const string_t text);
int main(void);

Error Error__constructor(const string_t message) {
  Error self = (Error){ 0 };
  self.super.pulse__type_name = "Error";
  self.message = message;
  return self;
}

string_t Error__static_method__toString(void) {
  return STRING_LITERAL("class Error {\n  public val message: string;\n  public fn constructor(val message: string);\n}");
}

ParseError ParseError__constructor(const string_t message) {
  ParseError self = (ParseError){ 0 };
  self.super.super.pulse__type_name = "ParseError";
  (self.super = Error__constructor(message));
  self.super.super.pulse__type_name = "ParseError";
  return self;
}

string_t ParseError__static_method__toString(void) {
  return STRING_LITERAL("class ParseError extends Error {\n  public fn constructor(val message: string);\n}");
}

IoError IoError__constructor(const string_t message) {
  IoError self = (IoError){ 0 };
  self.super.super.pulse__type_name = "IoError";
  (self.super = Error__constructor(message));
  self.super.super.pulse__type_name = "IoError";
  return self;
}

string_t IoError__static_method__toString(void) {
  return STRING_LITERAL("class IoError extends Error {\n  public fn constructor(val message: string);\n}");
}

parse__result_t parse(const string_t text) {
  if ((string_t_equal(text, STRING_LITERAL("")))) {
    return (parse__result_t){ .value = (int_t_nullable){ .is_null = true, .value = 0 }, .error = (unknown_t_nullable){ .is_null = false, .value = (unknown_t){ .type_name = "ParseError", .value.ParseError_value = ParseError__constructor(STRING_LITERAL("Empty text")) } } };
  }
  return (parse__result_t){ .value = (int_t_nullable){ .is_null = false, .value = 10 }, .error = (unknown_t_nullable){ .is_null = true, .value = { .type_name = NULL } } };
}

IoError_nullable save(const string_t text) {
  if ((string_t_equal(text, STRING_LITERAL("")))) {
    return (IoError_nullable){ .is_null = false, .value = IoError__constructor(STRING_LITERAL("Empty text")) };
  }
  return (IoError_nullable){ .is_null = true, .value = (IoError){ 0 } };
}

int main(void) {
  const parse__result_t pulse__result_0 = parse(STRING_LITERAL(""));
  const int_t_nullable value = pulse__result_0.value;
  const unknown_t_nullable err = pulse__result_0.error;
  IoError_nullable saveErr = save(STRING_LITERAL("ok"));
  if ((!saveErr.is_null)) {
    return 2;
  }
  if (((!err.is_null) && (!err.is_null && (strcmp(err.value.type_name, "ParseError") == 0)))) {
    return ((string_t_equal(err.value.value.ParseError_value.super.message, STRING_LITERAL("Empty text"))) ? 1 : 3);
  }
  return (value.is_null ? 0 : value.value);
}

