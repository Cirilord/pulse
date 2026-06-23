import CStd, { abs } from "c:stdlib.h";

fn main(): int {
  val direct: int = abs(-10);
  val namespaced: int = CStd.abs(-20);

  if (direct == 10 && namespaced == 20) {
    return 1;
  }

  return 0;
}
