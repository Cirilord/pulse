#include <stdbool.h>
#include <stddef.h>

int main(void);

int main(void) {
  const int a = 30;
  const int b = (a + 5);
  const int c = (30 + 5);
  int x = 0;
  x += 5;
  x -= 2;
  x *= 3;
  x %= 5;
  x /= 2;
  return 0;
}

