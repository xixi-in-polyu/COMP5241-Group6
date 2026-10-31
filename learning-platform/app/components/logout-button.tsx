"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

type LogoutButtonProps = {
  className: string;
  role?: "menuitem";
};

export function LogoutButton({ className, role }: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  async function handleLogout() {
    setIsLoading(true);
    setHasError(false);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      // Leave the app entirely so cached pages cannot be restored with the
      // "back" button after signing out.
      window.location.replace("/");
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      className={className}
      disabled={isLoading}
      onClick={handleLogout}
      role={role}
      title={hasError ? "Sign out failed. Try again." : undefined}
      type="button"
    >
      <LogOut aria-hidden="true" className="size-4" />
      {isLoading ? "Signing out..." : hasError ? "Retry logout" : "Logout"}
    </button>
  );
}
