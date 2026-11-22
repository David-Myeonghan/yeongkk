import { json, type Handler } from "./http";
import { readWordRequest } from "./validate";

export interface AskProvider {
  explain(word: string, locale: string): Promise<{ known: boolean; meaning?: string; note?: string }>;
}

export class NotEnabledError extends Error {
  constructor() {
    super("NOT_ENABLED");
  }
}

export const notEnabledProvider: AskProvider = {
  explain: () => Promise.reject(new NotEnabledError()),
};

const provider: AskProvider = notEnabledProvider;

export const postAsk: Handler = async (request) => {
  const read = await readWordRequest(request);
  if (!read.ok) return read.response;
  try {
    return Response.json(await provider.explain(read.value.word, read.value.locale));
  } catch (error) {
    if (error instanceof NotEnabledError) return json("NOT_ENABLED", 501);
    throw error;
  }
};
