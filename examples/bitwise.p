fn main(): int {
  val andResult: int = 6 & 3;
  val orResult: int = 6 | 3;
  val xorResult: int = 6 ^ 3;
  val leftShiftResult: int = 3 << 2;
  val rightShiftResult: int = 12 >> 1;
  val notResult: int = ~5;
  var mask: int = 7;
  mask &= 3;
  mask |= 8;
  mask ^= 2;
  mask <<= 1;
  mask >>= 2;

  return 0;
}
