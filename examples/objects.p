class User {
  public val name: string;
  private var age: int;

  public fn constructor(val name: string, val age: int) {
    this.name = name;
    this.age = age;
  }

  public fn birthday(): void {
    this.age += 1;
    return;
  }

  public fn getAge(): int {
    return this.age;
  }

  public static fn createAdult(val name: string): User {
    return User(name, 18);
  }
}

fn main(): int {
  var user: User = User("Ana", 20);
  user.birthday();

  val age: int = user.getAge();
  val adult: User = User.createAdult("Bob");
  val adultName: string = adult.name;

  if (adultName == "Bob") {
    return age;
  }

  return 0;
}
