import "server-only";

import { normalizeEmail } from "@/lib/auth/email";
import { hashPassword } from "@/lib/auth/password";

const REGISTRATION_ROLES = ["student", "teacher"] as const;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 10;
const REGISTRATION_WINDOW_MS = 15 * 60 * 1000;
const REGISTRATION_MAX_ATTEMPTS = 5;
const MAX_TRACKED_CLIENTS = 10_000;

type RegistrationInput = {
  email: string;
  password: string;
  confirmPassword: string;
  role: "student" | "teacher";
};

type RegistrationUser = {
  id: string;
  role: string;
};

type RegistrationDependencies = {
  findByEmail(email: string): Promise<RegistrationUser | null>;
  createUser(input: {
    email: string;
    password: string;
    role: "student" | "teacher";
  }): Promise<RegistrationUser>;
  createSession(userId: string): Promise<void>;
  isRateLimited(request: Request): boolean;
};

type ValidatedRegistration =
  | { valid: true; input: RegistrationInput }
  | { valid: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateRegistration(
  value: unknown,
): ValidatedRegistration {
  if (
    !isRecord(value) ||
    typeof value.email !== "string" ||
    typeof value.password !== "string" ||
    typeof value.confirmPassword !== "string" ||
    typeof value.role !== "string"
  ) {
    return { valid: false, error: "Complete all fields to create your account." };
  }

  const email = normalizeEmail(value.email);
  if (!email) {
    return { valid: false, error: "Enter a valid email address." };
  }

  if (
    value.password.length < MIN_PASSWORD_LENGTH ||
    value.password.length > MAX_PASSWORD_LENGTH
  ) {
    return {
      valid: false,
      error: "Password must be between 6 and 10 characters.",
    };
  }

  if (value.password !== value.confirmPassword) {
    return { valid: false, error: "Passwords do not match." };
  }

  if (
    value.role !== REGISTRATION_ROLES[0] &&
    value.role !== REGISTRATION_ROLES[1]
  ) {
    return {
      valid: false,
      error: "Choose either the student or teacher role.",
    };
  }

  return {
    valid: true,
    input: {
      email,
      password: value.password,
      confirmPassword: value.confirmPassword,
      role: value.role,
    },
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return isRecord(error) && "code" in error && error.code === "P2002";
}

export function createRegistrationRateLimiter(
  options: {
    maxAttempts?: number;
    windowMs?: number;
    now?: () => number;
  } = {},
) {
  const maxAttempts = options.maxAttempts ?? REGISTRATION_MAX_ATTEMPTS;
  const windowMs = options.windowMs ?? REGISTRATION_WINDOW_MS;
  const now = options.now ?? Date.now;
  const attempts = new Map<string, { count: number; expiresAt: number }>();

  return function isRateLimited(request: Request): boolean {
    const currentTime = now();
    for (const [key, record] of attempts) {
      if (record.expiresAt <= currentTime) {
        attempts.delete(key);
      }
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const clientKey =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      "unknown";
    const current = attempts.get(clientKey);

    if (current && current.expiresAt > currentTime) {
      if (current.count >= maxAttempts) {
        return true;
      }
      current.count += 1;
      return false;
    }

    if (attempts.size >= MAX_TRACKED_CLIENTS) {
      const oldestKey = attempts.keys().next().value;
      if (oldestKey !== undefined) {
        attempts.delete(oldestKey);
      }
    }

    attempts.set(clientKey, {
      count: 1,
      expiresAt: currentTime + windowMs,
    });
    return false;
  };
}

export function createRegistrationHandler(
  dependencies: RegistrationDependencies,
) {
  return async function POST(request: Request) {
    if (dependencies.isRateLimited(request)) {
      return Response.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Request body must be valid JSON." },
        { status: 400 },
      );
    }

    const validation = validateRegistration(body);
    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const { email, password, role } = validation.input;

    try {
      if (await dependencies.findByEmail(email)) {
        return Response.json(
          { error: "An account with this email already exists." },
          { status: 409 },
        );
      }

      const passwordHash = await hashPassword(password);
      const user = await dependencies.createUser({
        email,
        password: passwordHash,
        role,
      });

      await dependencies.createSession(user.id);
      return Response.json({ success: true, role }, { status: 201 });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return Response.json(
          { error: "An account with this email already exists." },
          { status: 409 },
        );
      }

      console.error("Account registration failed:", error);
      return Response.json(
        { error: "Unable to create your account right now. Please try again." },
        { status: 500 },
      );
    }
  };
}
