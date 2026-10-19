"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { normalizeEmail } from "@/lib/auth/email";

type RegistrationRole = "student" | "teacher";

function isErrorResponse(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  );
}

function isSuccessResponse(
  value: unknown,
): value is { role: RegistrationRole } {
  return (
    typeof value === "object" &&
    value !== null &&
    "role" in value &&
    (value.role === "student" || value.role === "teacher")
  );
}

const inputClass =
  "h-[50px] w-full rounded-xl border border-[#8799ad] bg-white px-4 text-base text-[#142f4d] outline-none transition focus:border-[#193b61] focus:ring-4 focus:ring-[#dce7f2] disabled:opacity-70";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<RegistrationRole>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setErrorMessage(
        "Enter a valid email address. Use an English period (.) in the domain, such as name@qq.com.",
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          confirmPassword,
          role,
        }),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        setErrorMessage(
          isErrorResponse(result)
            ? result.error
            : "Unable to create your account right now. Please try again.",
        );
        return;
      }

      if (!isSuccessResponse(result)) {
        setErrorMessage("The server returned an invalid registration response.");
        return;
      }

      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setRole("student");
      router.push(`/${result.role}`);
    } catch {
      setErrorMessage("Unable to create your account right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-5 py-10 sm:px-8">
      <section className="w-full max-w-[460px] rounded-2xl border border-[#e2e8f0] bg-[#f3f6fa] px-6 py-8 shadow-[0_12px_36px_-24px_rgba(24,54,87,0.24)] sm:px-10 sm:py-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[#193b61]">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-[#53657a]">
            Join the Learning Platform as a student or teacher.
          </p>
        </div>

        <form
          aria-busy={isLoading}
          className="mx-auto w-full max-w-[380px]"
          onSubmit={handleSubmit}
        >
          <fieldset disabled={isLoading}>
            <legend className="mb-3 text-sm font-medium text-[#263e58]">
              Register as
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {(["student", "teacher"] as const).map((option) => (
                <label
                  className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-[#193b61] ${
                    role === option
                      ? "border-[#193b61] bg-white text-[#193b61]"
                      : "border-[#cbd5e1] text-[#53657a]"
                  }`}
                  key={option}
                >
                  <input
                    checked={role === option}
                    className="accent-[#193b61]"
                    name="role"
                    onChange={() => setRole(option)}
                    type="radio"
                    value={option}
                  />
                  {option === "student" ? "Student" : "Teacher"}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-5">
            <label
              className="mb-2 block text-sm font-medium text-[#263e58]"
              htmlFor="register-email"
            >
              Email
            </label>
            <input
              autoComplete="email"
              className={inputClass}
              disabled={isLoading}
              id="register-email"
              maxLength={254}
              name="email"
              onChange={(event) => setEmail(event.currentTarget.value)}
              inputMode="email"
              required
              type="text"
              value={email}
            />
            <p className="mt-2 text-xs leading-5 text-[#53657a]">
              Use a standard email address with an English period (.), e.g.
              name@example.com.
            </p>
          </div>

          <div className="mt-5">
            <label
              className="mb-2 block text-sm font-medium text-[#263e58]"
              htmlFor="register-password"
            >
              Password
            </label>
            <input
              aria-describedby="password-requirements"
              autoComplete="new-password"
              className={inputClass}
              disabled={isLoading}
              id="register-password"
              maxLength={10}
              minLength={6}
              name="password"
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
              type="password"
              value={password}
            />
            <p
              className="mt-2 text-xs leading-5 text-[#53657a]"
              id="password-requirements"
            >
              Use 6 to 10 characters.
            </p>
          </div>

          <div className="mt-5">
            <label
              className="mb-2 block text-sm font-medium text-[#263e58]"
              htmlFor="confirm-password"
            >
              Confirm password
            </label>
            <input
              autoComplete="new-password"
              className={inputClass}
              disabled={isLoading}
              id="confirm-password"
              maxLength={10}
              minLength={6}
              name="confirmPassword"
              onChange={(event) =>
                setConfirmPassword(event.currentTarget.value)
              }
              required
              type="password"
              value={confirmPassword}
            />
          </div>

          {errorMessage && (
            <p className="mt-4 text-sm leading-5 text-red-700" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            className="mt-7 min-h-[50px] w-full rounded-xl bg-[#193b61] px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#244d78] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#1e3a5f] active:bg-[#122c49] disabled:cursor-wait disabled:opacity-70"
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#53657a]">
          Already have an account?{" "}
          <Link
            className="font-semibold text-[#193b61] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
            href="/"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
