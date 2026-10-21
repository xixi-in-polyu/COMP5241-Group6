import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Beaker } from "lucide-react";
import { requirePageRole } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function StudentCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  await requirePageRole("student");
  const { courseId } = await params;
  const course = await prisma.course.findFirst({ where: { id: courseId, status: "READY" }, select: { id: true, title: true, description: true, category: true, assignments: { where: { status: "SUBMITTED" }, orderBy: { submittedAt: "desc" }, include: { interactiveLabs: { where: { archivedAt: null } } } } } });
  if (!course) notFound();
  const assignments = course.assignments.filter((assignment) => assignment.interactiveLabs.some((lab) => lab.activeVersionId && lab.approvedVersionId === lab.activeVersionId));
  return <main className="min-h-screen bg-slate-50 px-5 py-8"><div className="mx-auto max-w-5xl"><Link href="/student" className="inline-flex items-center gap-2 text-sm font-semibold text-[#24496f]"><ArrowLeft className="size-4"/>Dashboard</Link><header className="mt-5 rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs font-semibold uppercase tracking-widest text-[#54738f]">{course.category || "Course"}</p><h1 className="mt-2 text-3xl font-semibold text-[#142f4d]">{course.title}</h1><p className="mt-2 text-sm text-slate-600">{course.description}</p></header><section className="mt-7"><h2 className="text-xl font-semibold text-[#193b61]">Interactive Labs</h2><div className="mt-4 grid gap-3">{assignments.map((assignment) => <Link key={assignment.id} href={`/student/assignments/${assignment.id}`} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-[#9bb2c8]"><span className="grid size-10 place-items-center rounded-xl bg-[#edf2f7] text-[#284b70]"><Beaker className="size-5"/></span><span className="min-w-0 flex-1"><b className="block text-[#193b61]">{assignment.title}</b><small className="mt-1 block text-slate-500">{assignment.interactiveLabs.filter((lab) => lab.activeVersionId && lab.approvedVersionId === lab.activeVersionId).length} approved Lab(s) · Practice only</small></span><ArrowRight className="size-4 text-slate-400"/></Link>)}{!assignments.length && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No Interactive Labs have been published yet.</p>}</div></section></div></main>;
}
