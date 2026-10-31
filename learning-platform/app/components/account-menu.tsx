"use client";

import { useEffect, useRef, useState } from "react";

import { LogoutButton } from "@/app/components/logout-button";

type AccountUser = { id: string; email: string };

type AccountMenuProps = {
  user: AccountUser;
};

export function AccountMenu({ user }: AccountMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="relative z-20" ref={menuRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Open account menu"
        className="grid size-12 place-items-center rounded-full bg-red-600 text-sm font-semibold lowercase text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {user.email.slice(0, 2)}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-xl"
          role="menu"
        >
          <div className="border-b border-slate-200 pb-3">
            <p className="truncate text-sm font-semibold text-[#193b61]">
              {user.email}
            </p>
          </div>

          <LogoutButton
            className="mt-3 flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-sm text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            role="menuitem"
          />
        </div>
      )}
    </div>
  );
}
