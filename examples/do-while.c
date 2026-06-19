#include <stdbool.h>
#include <stddef.h>

int main(void) {
  int counter = 0;
  do {
    counter += 1;
  } while ((counter < 2));
  return 0;
}
