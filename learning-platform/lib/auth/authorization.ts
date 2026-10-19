import "server-only";

import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/session-core";

const rolePaths: Record<Role, string> = {
  student: "/student",
  teacher: "/teacher",
  admin: "/admin",
};

export async function requirePageRole(role: Role) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/");
  }

  if (user.role !== role) {
    redirect(rolePaths[user.role]);
  }

  return user;
}

export async function authorizeApiRole(role: Role) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      response: Response.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
      user: null,
    } as const;
  }

  if (user.role !== role) {
    return {
      response: Response.json(
        { error: "You do not have permission to access this resource." },
        { status: 403 },
      ),
      user: null,
    } as const;
  }

  return { response: null, user } as const;
}
