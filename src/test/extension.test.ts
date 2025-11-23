import { convert } from "../extension";
import * as assert from "assert";

suite("convert()", () => {
  suite("Go to TypeScript", () => {
    test("struct with json tags", () => {
      const input = `type User struct {
	Name string \`json:"name"\`
	Age int \`json:"age"\`
}`;
      const expected = `interface User {
  name: string;
  age: number;
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("snakeCase", () => {
      const input = `type User struct {
	NameOfTheHero string
	Email string
	EmailTest string
}`;
      const expected = `type User struct {
	NameOfTheHero string \`json:"name_of_the_hero"\`
	Email string \`json:"email"\`
	EmailTest string \`json:"email_test"\`
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("struct with omitempty", () => {
      const input = `type User struct {
	Name string \`json:"name"\`
	Email string \`json:"email,omitempty"\`
}`;
      const expected = `interface User {
  name: string;
  email?: string | null;
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("struct with pointer fields", () => {
      const input = `type Product struct {
	ID string \`json:"id"\`
	Price *float64 \`json:"price"\`
}`;
      const expected = `interface Product {
  id: string;
  price?: number | null;
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("struct with array fields", () => {
      const input = `type Team struct {
	Name string \`json:"name"\`
	Members []string \`json:"members"\`
}`;
      const expected = `interface Team {
  name: string;
  members: string[];
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("struct with time.Time", () => {
      const input = `type Event struct {
	Name string \`json:"name"\`
	CreatedAt time.Time \`json:"createdAt"\`
}`;
      const expected = `interface Event {
  name: string;
  createdAt: string;
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("struct without json tags (enableJsonTagCheck=false)", () => {
      const input = `type Person struct {
	FirstName string
	LastName string
}`;
      const expected = `interface Person {
  firstName: string;
  lastName: string;
}`;
      assert.strictEqual(convert(input, false).result, expected);
    });
  });

  suite("TypeScript to Go", () => {
    test("basic interface", () => {
      const input = `interface User {
  name: string;
  age: number;
}`;
      const expected = `type User struct {
	Name string \`json:"name"\`
	Age int \`json:"age"\`
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("interface with optional fields", () => {
      const input = `interface Product {
  id: string;
  name?: string;
}`;
      const expected = `type Product struct {
	Id string \`json:"id"\`
	Name string \`json:"name,omitempty"\`
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("interface with arrays", () => {
      const input = `interface Team {
  members: string[];
  scores: number[];
}`;
      const expected = `type Team struct {
	Members []string \`json:"members"\`
	Scores []int \`json:"scores"\`
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("interface with boolean", () => {
      const input = `interface Settings {
  enabled: boolean;
}`;
      const expected = `type Settings struct {
	Enabled bool \`json:"enabled"\`
}`;
      assert.strictEqual(convert(input).result, expected);
    });
  });

  suite("Add Missing JSON Tags", () => {
    test("adds tags to struct without any", () => {
      const input = `type User struct {
	Name string
	Age int
}`;
      const expected = `type User struct {
	Name string \`json:"name"\`
	Age int \`json:"age"\`
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("adds tags only to fields missing them", () => {
      const input = `type Mixed struct {
	Name string \`json:"name"\`
	Age int
}`;
      const expected = `type Mixed struct {
	Name string \`json:"name"\`
	Age int \`json:"age"\`
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("preserves comments", () => {
      const input = `type User struct {
	Name string // full name
}`;
      const expected = `type User struct {
	Name string \`json:"name"\`  // full name
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("does not tag unexported fields", () => {
      const input = `type Config struct {
	PublicKey string
	privateKey string
}`;
      const expected = `type Config struct {
	PublicKey string \`json:"public_key"\`
	privateKey string
}`;
      assert.strictEqual(convert(input).result, expected);
    });
  });

  suite("Complex Go to TypeScript", () => {
    test("struct with nested custom types", () => {
      const input = `type User struct {
	ID int \`json:"id"\`
	Profile Profile \`json:"profile"\`
	Settings Settings \`json:"settings"\`
}`;
      const expected = `interface User {
  id: number;
  profile: Profile;
  settings: Settings;
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("struct with map fields", () => {
      const input = `type Settings struct {
	Theme string \`json:"theme"\`
	Notifications map[string]bool \`json:"notifications"\`
	Preferences map[string]string \`json:"preferences"\`
}`;
      const expected = `interface Settings {
  theme: string;
  notifications: map[string]bool;
  preferences: map[string]string;
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("struct with interface{} field", () => {
      const input = `type Response struct {
	Status string \`json:"status"\`
	Data interface{} \`json:"data"\`
}`;
      const expected = `interface Response {
  status: string;
  data: any;
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("struct with pointer to time.Time", () => {
      const input = `type Profile struct {
	Name string \`json:"name"\`
	DateOfBirth *time.Time \`json:"dateOfBirth"\`
}`;
      const expected = `interface Profile {
  name: string;
  dateOfBirth?: string | null;
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("struct with array of custom types", () => {
      const input = `type Team struct {
	Name string \`json:"name"\`
	Members []Member \`json:"members"\`
}`;
      const expected = `interface Team {
  name: string;
  members: Member[];
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("large struct with many fields", () => {
      const input = `type User struct {
	ID int \`json:"id"\`
	Username string \`json:"username"\`
	Email string \`json:"email"\`
	CreatedAt time.Time \`json:"createdAt"\`
	IsActive bool \`json:"isActive"\`
	Roles []string \`json:"roles"\`
	LoginCount int \`json:"loginCount"\`
}`;
      const expected = `interface User {
  id: number;
  username: string;
  email: string;
  createdAt: string;
  isActive: boolean;
  roles: string[];
  loginCount: number;
}`;
      assert.strictEqual(convert(input).result, expected);
    });
  });

  suite("Complex TypeScript to Go", () => {
    test("interface with many fields", () => {
      const input = `interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev?: boolean;
}`;
      const expected = `type Pagination struct {
	Page int \`json:"page"\`
	PageSize int \`json:"pageSize"\`
	TotalItems int \`json:"totalItems"\`
	TotalPages int \`json:"totalPages"\`
	HasNext bool \`json:"hasNext"\`
	HasPrev bool \`json:"hasPrev,omitempty"\`
}`;
      assert.strictEqual(convert(input).result, expected);
    });

    test("interface with custom type arrays", () => {
      const input = `interface Team {
  name: string;
  members: Member[];
  projects: Project[];
}`;
      const expected = `type Team struct {
	Name string \`json:"name"\`
	Members []Member \`json:"members"\`
	Projects []Project \`json:"projects"\`
}`;
      assert.strictEqual(convert(input).result, expected);
    });
  });

  suite("Error Cases", () => {
    test("empty input", () => {
      const { result, error } = convert("");
      assert.strictEqual(result, "");
      assert.strictEqual(error, "Select a Go struct or TS interface.");
    });

    test("invalid input", () => {
      const { result, error } = convert("random text");
      assert.strictEqual(result, "");
      assert.strictEqual(error, "Not a Go struct or TS interface.");
    });

    test("whitespace only", () => {
      const { result, error } = convert("   \n\t  ");
      assert.strictEqual(result, "");
      assert.strictEqual(error, "Select a Go struct or TS interface.");
    });
  });
});
