#include <stdbool.h>
#include <stddef.h>
#include <stdlib.h>
#include <unistd.h>

extern int optind;

int abs(const int value);
int main(void);

int main(void) {
  const int direct = abs((-10));
  const int optionIndex = optind;
  if (((direct == 10) && (optionIndex >= 0))) {
    return 1;
  }
  return 0;
}

