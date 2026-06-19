fn main(): int {
  val equalCheck: boolean = 3 == 3;
  val notEqualCheck: boolean = 3 != 4;
  val lessCheck: boolean = 2 < 3;
  val lessOrEqualCheck: boolean = 3 <= 3;
  val greaterCheck: boolean = 4 > 3;
  val greaterOrEqualCheck: boolean = 4 >= 4;
  val andCheck: boolean = true && false;
  val orCheck: boolean = true || false;
  val unaryNot: boolean = !false;
  val unaryMinus: int = -5 + 2;
  val unaryPlus: int = +5;
  var enabled: boolean = false;
  enabled ||= true;
  enabled &&= false;
  val ternaryValue: int = true ? 1 : 2;
  var missingAlias: string? = null;
  val aliasIsMissing: boolean = missingAlias == null;
  val aliasIsPresent: boolean = missingAlias != null;
  var otherAlias: string? = null;
  val aliasesMatch: boolean = missingAlias == otherAlias;
  val aliasesDiffer: boolean = missingAlias != otherAlias;
  var alias: string? = null;
  alias ??= "guest";
  val fallbackAlias: string = alias ?? "guest";

  return 0;
}
