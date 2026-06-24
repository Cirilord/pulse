import CLib from "c:stdlib.h" extern {
  fn abs(val value: int): int;
}

import Unix from "c:unistd.h" extern {
  var optind: int;
}

fn main(): int {
  val direct: int = CLib.abs(-10);
  val optionIndex: int = Unix.optind;

  if (direct == 10 && optionIndex >= 0) {
    return 1;
  }

  return 0;
}
