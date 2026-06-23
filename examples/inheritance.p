class Person {
  public val name: string;

  public fn constructor(val name: string) {
    this.name = name;
  }

  public fn getLabel(): string {
    return this.name;
  }

  public fn getType(): string {
    return "person";
  }
}

class Admin extends Person {
  public val role: string;

  public fn constructor(val name: string, val role: string) {
    super(name);
    this.role = role;
  }

  public fn getRole(): string {
    return this.role;
  }

  public override fn getType(): string {
    return "admin";
  }

  public fn getBaseType(): string {
    return super.getType();
  }

  public fn getBaseName(): string {
    return super.name;
  }

  public static fn createRoot(): Admin {
    return Admin("Root", "admin");
  }
}

fn main(): int {
  val admin: Admin = Admin.createRoot();
  val adminName: string = admin.name;
  val label: string = admin.getLabel();
  val type: string = admin.getType();
  val baseType: string = admin.getBaseType();
  val baseName: string = admin.getBaseName();
  val role: string = admin.getRole();
  val isPerson: boolean = isInstance(admin, Person);

  if (isPerson && adminName == "Root" && label == "Root" && type == "admin" && baseType == "person" && baseName == "Root" && role == "admin") {
    return 1;
  }

  return 0;
}
