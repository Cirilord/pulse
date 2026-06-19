#include <stdbool.h>
#include <stddef.h>

int sum(int a, int b);
void logValue(int value);
int main(void);

int sum(int a, int b) {
  return (a + b);
}

void logValue(int value) {
  return;
}

int main(void) {
  const int result = sum(10, 20);
  logValue(result);
  return 0;
}

