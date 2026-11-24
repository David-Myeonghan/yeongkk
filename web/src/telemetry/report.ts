import { deadline } from "./timeout";

export type ReportResult = "ok" | "rejected" | "limited" | "failed";

export async function submitReport(
  fetchFn: typeof fetch,
  api: string,
  body: { anonId: string; locale: string; word: string },
): Promise<ReportResult> {
  const limit = deadline();
  try {
    const res = await limit.race(
      fetchFn(`${api.replace(/\/+$/, "")}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        referrerPolicy: "no-referrer",
        signal: limit.signal,
      }),
    );
    if (res === null) return "failed";
    if (res.status === 204) return "ok";
    if (res.status === 400) return "rejected";
    if (res.status === 429) return "limited";
    return "failed";
  } catch {
    return "failed";
  } finally {
    limit.clear();
  }
}
