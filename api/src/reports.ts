import { countReportsSince, insertReport } from "./db";
import { json, noContent, type Handler } from "./http";
import { dayOf } from "./time";
import { readWordRequest } from "./validate";

const DAILY_LIMIT = 20;

export const postReports: Handler = async (request, env, now) => {
  const read = await readWordRequest(request);
  if (!read.ok) return read.response;
  const { anonId, locale, word } = read.value;
  const at = now();
  const day = dayOf(at);
  if ((await countReportsSince(env, anonId, day)) >= DAILY_LIMIT) return json("RATE_LIMITED", 429);
  await insertReport(env, { receivedAt: new Date(at).toISOString(), day, locale, word, anonId });
  return noContent();
};
