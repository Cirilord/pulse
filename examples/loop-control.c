#include <stdbool.h>
#include <stddef.h>

int main(void) {
  int whileCounter = 0;
  while ((whileCounter < 4)) {
    whileCounter += 1;
    if ((whileCounter == 2)) {
      continue;
    }
    if ((whileCounter == 4)) {
      break;
    }
  }
  int doCounter = 0;
  do {
    doCounter += 1;
    if ((doCounter == 2)) {
      break;
    }
  } while ((doCounter < 4));
  return 0;
}
