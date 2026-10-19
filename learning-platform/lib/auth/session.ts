import "server-only";

import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  getSessionExpiration,
  hashSessionToken,
  isRole,
  isSessionExpired,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  type Role,
} from "@/lib/auth/session-core";

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: Role;
};

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function createSession(userId: string) {
  const cookieStore = await cookies();
  const previousToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const token = createSessionToken();
  const expiresAt = getSessionExpiration();

  await prisma.$transaction(async (transaction) => {
    if (previousToken) {
      await transaction.session.deleteMany({
        where: { tokenHash: hashSessionToken(previousToken) },
      });
    }

    await transaction.session.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId,
        expiresAt,
      },
    });
  });

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    ...cookieOptions,
    expires: expiresAt,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (isSessionExpired(session.expiresAt)) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
    return null;
  }

  if (!isRole(session.user.role)) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  };
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...cookieOptions,
    expires: new Date(0),
    maxAge: 0,
  });
}
