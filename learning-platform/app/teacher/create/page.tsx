import { redirect } from "next/navigation";

export default function LegacyTeacherCreatePage() {
  redirect("/courses/create");
}
