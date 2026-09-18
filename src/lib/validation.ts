/**
 * Registration input rules. Pure and client-safe, imported by both the form
 * (for instant feedback) and the API (for enforcement), so the two can never
 * disagree about what a valid account looks like. The server is the authority;
 * the form only saves the user a round trip.
 */

export type RegisterField =
  | "businessName"
  | "regNo"
  | "address"
  | "contact"
  | "ownerName"
  | "email"
  | "password";

export interface RegisterInput {
  businessName: string;
  regNo: string;
  address: string;
  contact: string;
  ownerName: string;
  email: string;
  password: string;
}

// ── email ─────────────────────────────────────────────────────────────────

/**
 * A practical address check: a sensible local part, dot-separated domain
 * labels that don't start or end with a hyphen, and an alphabetic TLD of two
 * or more letters. Stricter than "has an @", looser than the full RFC grammar,
 * which accepts addresses no mail provider would.
 */
const EMAIL_RE =
  /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function emailError(raw: string): string | null {
  const email = normalizeEmail(raw);
  if (!email) return "Enter your email address";
  if (email.length > 254) return "Email address is too long";
  if (email.includes("..")) return "Email address can't contain two dots in a row";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address, like name@example.com";
  return null;
}

// ── phone ─────────────────────────────────────────────────────────────────

/** Just the digits, with an optional +91 / 91 / 0 country or trunk prefix removed. */
export function phoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

/**
 * Exactly 10 digits, starting 6–9: an Indian mobile number. Mobile rather than
 * any phone because expiry reminders go out by SMS.
 */
export function phoneError(raw: string): string | null {
  const d = phoneDigits(raw);
  if (!d) return "Enter a mobile number";
  if (/[a-z]/i.test(raw)) return "Mobile number can only contain digits";
  if (d.length !== 10) return `Mobile number must be exactly 10 digits (you entered ${d.length})`;
  if (!/^[6-9]/.test(d)) return "Enter a valid Indian mobile number — it starts with 6, 7, 8 or 9";
  if (/^(\d)\1{9}$/.test(d)) return "Enter a real mobile number";
  return null;
}

/** Stored form: "+91 98765 43210". Call only after phoneError returned null. */
export function formatPhone(raw: string): string {
  const d = phoneDigits(raw);
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

// ── password ──────────────────────────────────────────────────────────────

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export interface PasswordRule {
  key: "length" | "upper" | "lower" | "digit" | "symbol";
  label: string;
  ok: boolean;
}

/** Each rule with whether it is met — drives the live checklist in the form. */
export function passwordRules(password: string): PasswordRule[] {
  return [
    { key: "length", label: `At least ${PASSWORD_MIN} characters`, ok: password.length >= PASSWORD_MIN },
    { key: "upper", label: "An uppercase letter", ok: /[A-Z]/.test(password) },
    { key: "lower", label: "A lowercase letter", ok: /[a-z]/.test(password) },
    { key: "digit", label: "A number", ok: /\d/.test(password) },
    { key: "symbol", label: "A symbol, like ! @ # $", ok: /[^A-Za-z0-9\s]/.test(password) },
  ];
}

const MISSING: Record<PasswordRule["key"], string> = {
  length: `${PASSWORD_MIN}+ characters`,
  upper: "an uppercase letter",
  lower: "a lowercase letter",
  digit: "a number",
  symbol: "a symbol",
};

/**
 * The passwords that get tried first. Each one below technically satisfies the
 * character rules, which is exactly why they need listing.
 */
const COMMON_PASSWORDS = new Set([
  "password@1", "password@123", "password#1", "p@ssw0rd", "p@ssword1", "passw0rd!",
  "welcome@1", "welcome@123", "admin@123", "admin@1234", "qwerty@123", "qwerty@1",
  "abc@1234", "abcd@1234", "india@123", "india@1234", "test@123", "test@1234",
  "pass@123", "pass@1234", "user@123", "hello@123", "demo@1234", "changeme@1",
]);

export function passwordError(password: string, context: { email?: string; name?: string } = {}): string | null {
  if (!password) return "Choose a password";
  if (password.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters`;
  if (password !== password.trim()) return "Password can't start or end with a space";
  const unmet = passwordRules(password).filter((r) => !r.ok);
  if (unmet.length > 0) {
    return `Password needs: ${unmet.map((r) => MISSING[r.key]).join(", ")}`;
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return "That password is too common — choose something less predictable";
  if (/(.)\1{3,}/.test(password)) return "Password can't repeat the same character 4 times in a row";

  const local = normalizeEmail(context.email ?? "").split("@")[0];
  if (local.length >= 4 && lower.includes(local)) return "Password can't contain your email name";
  const firstName = (context.name ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (firstName.length >= 4 && lower.includes(firstName)) return "Password can't contain your name";
  return null;
}

// ── the rest of the form ─────────────────────────────────────────────────

export function nameError(raw: string, what: "Your name" | "Business name"): string | null {
  const v = raw.trim();
  if (!v) return `${what} is required`;
  if (v.length < 2) return `${what} is too short`;
  if (v.length > (what === "Your name" ? 80 : 120)) return `${what} is too long`;
  if (what === "Your name" && !/^[\p{L}][\p{L} .'-]*$/u.test(v)) {
    return "Name can only contain letters, spaces, dots, apostrophes and hyphens";
  }
  if (what === "Business name") {
    if (!/\p{L}/u.test(v)) {
      return "Business name must contain letters, not only numbers or symbols";
    }
    if (/^(.)\1+$/.test(v)) {
      return "Enter a realistic business name, not repeated characters";
    }
  }
  return null;
}


export function regNoError(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "Registration number is required";
  if (v.length < 5 || v.length > 30) return "Registration number must be 5–30 characters";
  if (!/^[A-Za-z0-9][A-Za-z0-9/-]*$/.test(v)) return "Use only letters, numbers, hyphens and slashes";
  return null;
}

export function addressError(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "Premises address is required";
  if (v.length < 10) return "Enter the full premises address";
  if (v.length > 300) return "Address is too long";
  return null;
}

/** Business step, in form order. */
export function businessErrors(i: Pick<RegisterInput, "businessName" | "regNo" | "address" | "contact">) {
  return {
    businessName: nameError(i.businessName, "Business name"),
    regNo: regNoError(i.regNo),
    address: addressError(i.address),
    contact: phoneError(i.contact),
  };
}

/** Login step, in form order. */
export function loginErrors(i: Pick<RegisterInput, "ownerName" | "email" | "password">) {
  return {
    ownerName: nameError(i.ownerName, "Your name"),
    email: emailError(i.email),
    password: passwordError(i.password, { email: i.email, name: i.ownerName }),
  };
}

/** First failing field across the whole form, or null when everything is valid. */
export function firstRegisterError(i: RegisterInput): { field: RegisterField; error: string } | null {
  const all = { ...businessErrors(i), ...loginErrors(i) } as Record<RegisterField, string | null>;
  for (const [field, error] of Object.entries(all) as Array<[RegisterField, string | null]>) {
    if (error) return { field, error };
  }
  return null;
}
