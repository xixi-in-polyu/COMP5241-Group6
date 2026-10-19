import { deleteSession } from "@/lib/auth/session";

export async function POST() {
  try {
    await deleteSession();
    return Response.json({ success: true });
  } catch (error) {
    console.error("Logout failed:", error);
    return Response.json(
      { error: "Unable to sign out right now. Please try again." },
      { status: 500 },
    );
  }
}
