import { clearExpiredUsagePayloads } from "@/lib/assignments/usage";

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const result = await clearExpiredUsagePayloads();
  return Response.json({ cleared: result.count });
}
