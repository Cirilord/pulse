#include <stdbool.h>
#include <stddef.h>

int sum(const int a, const int b);
void logValue(const int value);
int main(void);

int sum(const int a, const int b) {
  return (a + b);
}

void logValue(const int value) {
  return;
}

int main(void) {
  const int result = sum(10, 20);
  logValue(result);
  return 0;
}

