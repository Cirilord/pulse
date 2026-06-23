#include <stdbool.h>
#include <stddef.h>

void cleanup(const int value);
int run(void);
int main(void);

void cleanup(const int value) {
  return;
}

int run(void) {
  {
    cleanup(10);
  }
  int counter = 0;
  while ((counter < 2)) {
    if ((counter == 0)) {
      counter += 1;
      cleanup(counter);
      continue;
    }
    cleanup(counter);
    break;
  }
  cleanup(99);
  return counter;
}

int main(void) {
  return run();
}

