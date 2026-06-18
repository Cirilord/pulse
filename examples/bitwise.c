#include <stdbool.h>
#include <stddef.h>

int main(void) {
  const int andResult = (6 & 3);
  const int orResult = (6 | 3);
  const int xorResult = (6 ^ 3);
  const int leftShiftResult = (3 << 2);
  const int rightShiftResult = (12 >> 1);
  const int notResult = (~5);
  int mask = 7;
  mask &= 3;
  mask |= 8;
  mask ^= 2;
  mask <<= 1;
  mask >>= 2;
  return 0;
}
