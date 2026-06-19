fn buildError(): Error {
  return Error("Invalid age");
}

fn main(): int {
  val error: Error = buildError();

  if (error.message == "Invalid age") {
    return 1;
  }

  return 0;
}
