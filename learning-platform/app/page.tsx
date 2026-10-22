"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type KeyboardEvent } from "react";

type Role = "student" | "teacher";

const roles: Role[] = ["student", "teacher"];

const rolePaths: Record<Role, string> = {
  student: "/student",
  teacher: "/teacher",
};

const roleLabels: Record<Role, string> = {
  student: "Student",
  teacher: "Teacher",
};

function isErrorResponse(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  );
}

function isSuccessResponse(value: unknown): value is { role: Role } {
  return (
    typeof value === "object" &&
    value !== null &&
    "role" in value &&
    roles.includes(value.role as Role)
  );
}

export default function Home() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function handleRoleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = roles.indexOf(role);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % roles.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + roles.length) % roles.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = roles.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextRole = roles[nextIndex];
    setRole(nextRole);
    setErrorMsg("");
    document.getElementById(`role-tab-${nextRole}`)?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
          role,
        }),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        setErrorMsg(
          isErrorResponse(result)
            ? result.error
            : "Unable to sign in right now. Please try again.",
        );
        return;
      }

      if (!isSuccessResponse(result)) {
        setErrorMsg("The server returned an invalid sign-in response.");
        return;
      }

      router.push(rolePaths[result.role]);
    } catch {
      setErrorMsg("Unable to sign in right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-5 py-10 sm:px-8">
      <section className="w-full max-w-[460px] rounded-2xl border border-[#e2e8f0] bg-[#f3f6fa] px-6 py-8 shadow-[0_12px_36px_-24px_rgba(24,54,87,0.24)] sm:px-10 sm:py-10">
        <div className="mb-9 flex items-center justify-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-xl bg-[#193b61] text-white"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none">
              <path
                d="M4.5 5.5h15v13h-15zM8 9h8M8 12h8M8 15h5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.02em] text-[#193b61]">
            Learning Platform
          </span>
        </div>

        <form
          className="mx-auto w-full max-w-[380px]"
          onSubmit={handleSubmit}
          aria-busy={isLoading}
        >
        <div>
          <p
            id="role-label"
            className="mb-3 text-sm font-medium text-[#263e58]"
          >
            Sign in as
          </p>
          <div
            aria-labelledby="role-label"
            className="grid grid-cols-2 gap-1 rounded-xl bg-[#e8edf3] p-1"
            onKeyDown={handleRoleKeyDown}
            role="tablist"
          >
            {roles.map((option) => {
              const selected = option === role;

              return (
                <button
                  key={option}
                  id={`role-tab-${option}`}
                  type="button"
                  role="tab"
                  aria-controls="login-fields"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  disabled={isLoading}
                  onClick={() => {
                    setRole(option);
                    setErrorMsg("");
                  }}
                  className={`role-tab min-h-11 rounded-[9px] px-2 text-sm font-medium transition-colors ${
                    selected
                      ? "bg-white text-[#193b61] shadow-[0_1px_5px_rgb(20_47_77_/_14%)]"
                      : "text-[#53657a]"
                  }`}
                >
                  {roleLabels[option]}
                </button>
              );
            })}
          </div>
        </div>

        <div
          id="login-fields"
          className="mt-7"
          role="tabpanel"
          aria-labelledby={`role-tab-${role}`}
        >
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-[#263e58]"
            >
              Email
            </label>
            <input
              autoComplete="email"
              className="h-[50px] w-full rounded-xl border border-[#8799ad] bg-white px-4 text-base text-[#142f4d] outline-none transition focus:border-[#193b61] focus:ring-4 focus:ring-[#dce7f2]"
              id="email"
              name="email"
              placeholder="name@polyu.hk"
              required
              type="email"
            />
          </div>

          <div className="mt-5">
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-[#263e58]"
            >
              Password
            </label>
            <input
              autoComplete="current-password"
              className="h-[50px] w-full rounded-xl border border-[#8799ad] bg-white px-4 text-base text-[#142f4d] outline-none transition focus:border-[#193b61] focus:ring-4 focus:ring-[#dce7f2]"
              id="password"
              name="password"
              placeholder="Enter your password"
              required
              type="password"
            />
          </div>
        </div>

        {errorMsg && (
          <p className="mt-4 text-sm leading-5 text-red-700" role="alert">
            {errorMsg}
          </p>
        )}

        <button
          className="mt-7 min-h-[50px] w-full rounded-xl bg-[#193b61] px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#244d78] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#1e3a5f] active:bg-[#122c49] disabled:cursor-wait disabled:opacity-70"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </button>
        </form>
        <Link
          className="mt-5 block rounded-xl border border-[#193b61] bg-white px-4 py-3 text-center text-sm font-semibold text-[#193b61] transition-colors hover:bg-[#edf2f7]"
          href="/interactive-learning"
        >
          Explore interactive learning
        </Link>
        <p className="mt-6 text-center text-sm text-[#53657a]">
          New to the platform?{" "}
          <Link
            className="font-semibold text-[#193b61] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#193b61]"
            href="/register"
          >
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
