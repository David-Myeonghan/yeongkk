export type ReportResult = "ok" | "rejected" | "limited" | "failed";

export async function submitReport(
  fetchFn: typeof fetch,
  api: string,
  body: { anonId: string; locale: string; word: string },
): Promise<ReportResult> {
  try {
    const res = await fetchFn(`${api.replace(/\/+$/, "")}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 204) return "ok";
    if (res.status === 400) return "rejected";
    if (res.status === 429) return "limited";
    return "failed";
  } catch {
    return "failed";
  }
}
