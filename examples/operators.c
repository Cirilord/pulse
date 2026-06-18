#include <stdbool.h>
#include <stddef.h>

int main(void) {
  const bool equalCheck = (3 == 3);
  const bool notEqualCheck = (3 != 4);
  const bool lessCheck = (2 < 3);
  const bool lessOrEqualCheck = (3 <= 3);
  const bool greaterCheck = (4 > 3);
  const bool greaterOrEqualCheck = (4 >= 4);
  const bool andCheck = (true && false);
  const bool orCheck = (true || false);
  const bool unaryNot = (!false);
  const int unaryMinus = ((-5) + 2);
  const int unaryPlus = (+5);
  return 0;
}
