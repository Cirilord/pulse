#include <stdbool.h>
#include <stddef.h>
#include <stdlib.h>

int abs(const int value);
int main(void);

int main(void) {
  const int direct = abs((-10));
  const int namespaced = abs((-20));
  if (((direct == 10) && (namespaced == 20))) {
    return 1;
  }
  return 0;
}

