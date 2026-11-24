import { insertReportWithinLimit } from "./db";
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
  const row = { receivedAt: new Date(at).toISOString(), day, locale, word, anonId };
  return (await insertReportWithinLimit(env, row, DAILY_LIMIT)) ? noContent() : json("RATE_LIMITED", 429);
};
