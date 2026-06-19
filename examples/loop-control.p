fn main(): int {
  var whileCounter: int = 0;

  while (whileCounter < 4) {
    whileCounter += 1;

    if (whileCounter == 2) {
      continue;
    }

    if (whileCounter == 4) {
      break;
    }
  }

  var doCounter: int = 0;

  do {
    doCounter += 1;

    if (doCounter == 2) {
      break;
    }
  } while (doCounter < 4);

  return 0;
}
