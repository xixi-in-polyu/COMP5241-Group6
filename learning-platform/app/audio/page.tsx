import { requirePageRole } from "@/lib/auth/authorization";

import AudioExplanation from "./audio-explanation";

export const metadata = { title: "Audio explanation" };
export const instant = false;

export default async function AudioPage() {
  await requirePageRole("student");
  return <AudioExplanation />;
}
