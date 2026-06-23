fn cleanup(val value: int): void {
  return;
}

fn run(): int {
  defer cleanup(99);

  {
    defer cleanup(10);
  }

  var counter: int = 0;

  while (counter < 2) {
    defer cleanup(counter);

    if (counter == 0) {
      counter += 1;
      continue;
    }

    break;
  }

  return counter;
}

fn main(): int {
  return run();
}
