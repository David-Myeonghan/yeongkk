import { fnv1a32 } from "./rng";

export interface Experiment {
  id: string;
  variants: { name: string; weight: number }[];
  enabled: boolean;
}

function effectiveWeight(weight: number): number {
  return Number.isFinite(weight) && weight > 0 ? weight : 0;
}

export function assignVariant(anonId: string, exp: Experiment): string | null {
  if (!exp.enabled) return null;
  const total = exp.variants.reduce((sum, v) => sum + effectiveWeight(v.weight), 0);
  if (total <= 0) return null;

  const point = (fnv1a32(anonId + ":" + exp.id) / 4294967296) * total;
  let upper = 0;
  let last: string | null = null;
  for (const variant of exp.variants) {
    const weight = effectiveWeight(variant.weight);
    if (weight === 0) continue;
    upper += weight;
    last = variant.name;
    if (point < upper) return variant.name;
  }
  return last;
}
