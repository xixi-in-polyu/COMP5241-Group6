import { requirePageRole } from "@/lib/auth/authorization";
import GameClient from "./game-client";

export const instant = false;

export default async function SoftwareDevelopmentLifecyclePage() {
  await requirePageRole("student");
  return <GameClient />;
}
