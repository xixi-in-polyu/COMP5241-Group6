import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";
import { isRole } from "@/lib/auth/session-core";

const invalidCredentials = {
  error: "The account, password, or role does not match.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(invalidCredentials, { status: 401 });
  }

  if (
    !isRecord(body) ||
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    !isRole(body.role)
  ) {
    return Response.json(invalidCredentials, { status: 401 });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: body.email.trim().toLowerCase(),
          mode: "insensitive",
        },
        password: body.password,
        role: body.role,
      },
      select: { id: true, role: true },
    });

    if (!user) {
      return Response.json(invalidCredentials, { status: 401 });
    }

    await createSession(user.id);

    return Response.json({ success: true, role: user.role });
  } catch (error) {
    console.error("Login database query failed:", error);
    return Response.json(
      { error: "Unable to sign in right now. Please try again." },
      { status: 500 },
    );
  }
}
