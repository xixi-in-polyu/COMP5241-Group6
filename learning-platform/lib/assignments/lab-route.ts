import "server-only";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";

export function labConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ApiError(409, "Another Interactive Lab is already generating for this assignment.");
  }
  return error;
}

