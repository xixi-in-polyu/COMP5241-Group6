import { redirect } from "next/navigation";

export default function LegacyCreateMiniCoursePage() {
  redirect("/courses/create");
}
