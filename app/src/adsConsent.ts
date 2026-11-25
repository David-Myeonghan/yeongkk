export type ConsentOutcome = { ok: true; nonPersonalized: boolean } | { ok: false };

export interface ConsentDeps {
  gather(): Promise<{ canRequestAds: boolean; personalized: boolean }>;
  requestTracking?(): Promise<boolean>;
}

async function run(deps: ConsentDeps): Promise<ConsentOutcome> {
  let personalized: boolean;
  try {
    const info = await deps.gather();
    if (!info.canRequestAds) return { ok: false };
    personalized = info.personalized;
  } catch {
    return { ok: false };
  }
  let tracked = true;
  if (deps.requestTracking) {
    try {
      tracked = await deps.requestTracking();
    } catch {
      tracked = false;
    }
  }
  return { ok: true, nonPersonalized: !(personalized && tracked) };
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
