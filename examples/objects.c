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
  string_t name;
  int age;
} User;

User User__constructor(const string_t name, const int age);
void User__method__birthday(User *self);
int User__method__getAge(const User *self);
User User__static_method__createAdult(const string_t name);
int main(void);

User User__constructor(const string_t name, const int age) {
  User self = (User){ 0 };
  self.pulse__type_name = "User";
  self.name = name;
  self.age = age;
  return self;
}

void User__method__birthday(User *self) {
  self->age += 1;
  return;
}

int User__method__getAge(const User *self) {
  return self->age;
}

User User__static_method__createAdult(const string_t name) {
  return User__constructor(name, 18);
}

int main(void) {
  User user = User__constructor(STRING_LITERAL("Ana"), 20);
  User__method__birthday(&user);
  const int age = User__method__getAge(&user);
  User adult = User__static_method__createAdult(STRING_LITERAL("Bob"));
  const string_t adultName = adult.name;
  const bool adultIsUser = (strcmp(adult.pulse__type_name, "User") == 0);
  if ((adultIsUser && (string_t_equal(adultName, STRING_LITERAL("Bob"))))) {
    return age;
  }
  return 0;
}

