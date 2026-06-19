#include <stdbool.h>
#include <stddef.h>

int main(void) {
  const int a = 1;
  {
    const int a = 2;
    int b = (a + 1);
    b += 2;
  }
  int c = (a + 3);
  return 0;
}
