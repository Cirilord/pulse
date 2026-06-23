class ParseError extends Error {
  public fn constructor(val message: string) {
    super(message);
  }
}

class IoError extends Error {
  public fn constructor(val message: string) {
    super(message);
  }
}

fn parse(val text: string): int? throws ParseError, IoError {
  if (text == "") {
    return null, ParseError("Empty text");
  }

  return 10, null;
}

fn save(val text: string): void throws IoError {
  if (text == "") {
    return IoError("Empty text");
  }

  return null;
}

fn main(): int {
  val value: int?, val err: unknown? = parse("");
  val saveErr: IoError? = save("ok");

  if (saveErr != null) {
    return 2;
  }

  if (err != null && isInstance(err, ParseError)) {
    return err.message == "Empty text" ? 1 : 3;
  }

  return value ?? 0;
}
