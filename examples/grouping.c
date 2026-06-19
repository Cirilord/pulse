#include <stdbool.h>
#include <stddef.h>

int main(void);

int main(void) {
  const int grouped = (((30 + 5)) * 2);
  const bool nested = (!((true || false)));
  const int mixed = (((10 - ((2 + 3)))) * ((+2)));
  return 0;
}

