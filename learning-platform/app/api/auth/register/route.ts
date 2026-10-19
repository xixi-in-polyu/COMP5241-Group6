import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";
import {
  createRegistrationHandler,
  createRegistrationRateLimiter,
} from "@/lib/auth/registration";

export const POST = createRegistrationHandler({
  async findByEmail(email) {
    return prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, role: true },
    });
  },
  async createUser(input) {
    return prisma.user.create({
      data: input,
      select: { id: true, role: true },
    });
  },
  createSession,
  isRateLimited: createRegistrationRateLimiter(),
});
