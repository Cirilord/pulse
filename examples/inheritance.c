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
  string_t name;
} Person;

typedef struct {
  Person super;
  string_t role;
} Admin;

const string_t Person__static_arg__name = STRING_LITERAL("Person");

const string_t Admin__static_arg__name = STRING_LITERAL("Admin");

Person Person__constructor(const string_t name);
string_t Person__static_method__toString(void);
string_t Person__method__getLabel(const Person *self);
string_t Person__method__getType(const Person *self);
Admin Admin__constructor(const string_t name, const string_t role);
string_t Admin__static_method__toString(void);
string_t Admin__method__getRole(const Admin *self);
string_t Admin__method__getType(const Admin *self);
string_t Admin__method__getBaseType(const Admin *self);
string_t Admin__method__getBaseName(const Admin *self);
Admin Admin__static_method__createRoot(void);
int main(void);

Person Person__constructor(const string_t name) {
  Person self = (Person){ 0 };
  self.super.pulse__type_name = "Person";
  self.name = name;
  return self;
}

string_t Person__static_method__toString(void) {
  return STRING_LITERAL("class Person {\n  public val name: string;\n  public fn constructor(val name: string);\n  public fn getLabel(): string;\n  public fn getType(): string;\n}");
}

string_t Person__method__getLabel(const Person *self) {
  return self->name;
}

string_t Person__method__getType(const Person *self) {
  return STRING_LITERAL("person");
}

Admin Admin__constructor(const string_t name, const string_t role) {
  Admin self = (Admin){ 0 };
  self.super.super.pulse__type_name = "Admin";
  (self.super = Person__constructor(name));
  self.role = role;
  self.super.super.pulse__type_name = "Admin";
  return self;
}

string_t Admin__static_method__toString(void) {
  return STRING_LITERAL("class Admin extends Person {\n  public val role: string;\n  public fn constructor(val name: string, val role: string);\n  public fn getRole(): string;\n  public override fn getType(): string;\n  public fn getBaseType(): string;\n  public fn getBaseName(): string;\n  public static fn createRoot(): Admin;\n}");
}

string_t Admin__method__getRole(const Admin *self) {
  return self->role;
}

string_t Admin__method__getType(const Admin *self) {
  return STRING_LITERAL("admin");
}

string_t Admin__method__getBaseType(const Admin *self) {
  return Person__method__getType(&self->super);
}

string_t Admin__method__getBaseName(const Admin *self) {
  return (self->super).name;
}

Admin Admin__static_method__createRoot(void) {
  return Admin__constructor(STRING_LITERAL("Root"), STRING_LITERAL("admin"));
}

int main(void) {
  Admin admin = Admin__static_method__createRoot();
  const string_t adminName = admin.super.name;
  const string_t label = Person__method__getLabel(&admin.super);
  const string_t type = Admin__method__getType(&admin);
  const string_t baseType = Admin__method__getBaseType(&admin);
  const string_t baseName = Admin__method__getBaseName(&admin);
  const string_t role = Admin__method__getRole(&admin);
  const bool isPerson = (strcmp(admin.super.super.pulse__type_name, "Person") == 0 || strcmp(admin.super.super.pulse__type_name, "Admin") == 0);
  if (((((((isPerson && (string_t_equal(adminName, STRING_LITERAL("Root")))) && (string_t_equal(label, STRING_LITERAL("Root")))) && (string_t_equal(type, STRING_LITERAL("admin")))) && (string_t_equal(baseType, STRING_LITERAL("person")))) && (string_t_equal(baseName, STRING_LITERAL("Root")))) && (string_t_equal(role, STRING_LITERAL("admin"))))) {
    return 1;
  }
  return 0;
}

