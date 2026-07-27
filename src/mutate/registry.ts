import { homoglyph, leetspeak, zeroWidth } from "./mutators/char-level.js";
import { languageSwitch, manyShotPadding } from "./mutators/context.js";
import { base64, rot13, unicodeTags } from "./mutators/encoding.js";
import {
  bidiOverride,
  charSpacing,
  emojiSmuggling,
  flipAttack,
  sneakyBits,
  upsideDown,
} from "./mutators/smuggling.js";
import { markdownComment, payloadSplitting } from "./mutators/structural.js";
import { MUTATOR_IDS, type Mutator, type MutatorId } from "./types.js";

const ALL: readonly Mutator[] = [
  languageSwitch,
  leetspeak,
  homoglyph,
  zeroWidth,
  bidiOverride,
  charSpacing,
  unicodeTags,
  emojiSmuggling,
  sneakyBits,
  upsideDown,
  payloadSplitting,
  markdownComment,
  manyShotPadding,
  rot13,
  base64,
  flipAttack,
];

const BY_ID = new Map<MutatorId, Mutator>(ALL.map((m) => [m.id, m]));

// Registry and the MutatorId union must not drift apart.
for (const id of MUTATOR_IDS) {
  if (!BY_ID.has(id)) throw new Error(`Mutator "${id}" is declared in MUTATOR_IDS but not registered.`);
}

export const MUTATORS: readonly Mutator[] = ALL;

export function getMutator(id: string): Mutator | undefined {
  return BY_ID.get(id as MutatorId);
}

export function isMutatorId(id: string): id is MutatorId {
  return BY_ID.has(id as MutatorId);
}
