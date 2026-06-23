#include <stdbool.h>
#include <stddef.h>

int extraValue = 0;

static void pulse__init_globals(void) {
  extraValue = 2;
}

int increment(const int value);

int increment(const int value) {
  return (value + 1);
}

