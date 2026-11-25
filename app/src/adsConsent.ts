export type ConsentOutcome = { ok: true; nonPersonalized: boolean } | { ok: false };

export type TrackingAnswer = "granted" | "denied" | "not-asked";

export interface ConsentFacts {
  canRequestAds: boolean;
  gdprApplies: boolean;
  selectedPersonalised: boolean;
}

export interface ConsentDeps {
  gather(): Promise<ConsentFacts>;
  requestTracking?(): Promise<boolean>;
  initialize(): Promise<void>;
}

export function decidePersonalization(input: {
  gdprApplies: boolean;
  selectedPersonalised: boolean;
  tracking: TrackingAnswer;
}): boolean {
  const consentBlocks = input.gdprApplies && !input.selectedPersonalised;
  return consentBlocks || input.tracking === "denied";
}

async function askTracking(request: ConsentDeps["requestTracking"]): Promise<TrackingAnswer> {
  if (!request) return "not-asked";
  try {
    return (await request()) ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

async function run(deps: ConsentDeps): Promise<ConsentOutcome> {
  try {
    const facts = await deps.gather();
    if (!facts.canRequestAds) return { ok: false };
    const tracking = await askTracking(deps.requestTracking);
    await deps.initialize();
    return {
      ok: true,
      nonPersonalized: decidePersonalization({
        gdprApplies: facts.gdprApplies,
        selectedPersonalised: facts.selectedPersonalised,
        tracking,
      }),
    };
  } catch {
    return { ok: false };
  }
}

export function createConsentGate(deps: ConsentDeps): () => Promise<ConsentOutcome> {
  let inFlight: Promise<ConsentOutcome> | null = null;
  return () => {
    inFlight ??= run(deps).then((outcome) => {
      if (!outcome.ok) inFlight = null;
      return outcome;
    });
    return inFlight;
  };
}
