/**
 * A thin screen on the free-text payload.
 *
 * JANUS takes an arbitrary instruction and dresses it in documented injection
 * techniques. That is what an offensive tester needs, and it is the same shape
 * as PyRIT's converters or garak's probes. It also means there is no closed
 * enum to hide behind: the user supplies the objective, as free text.
 *
 * So this is the only screen there is, and it is worth being precise about it:
 *
 *   It catches careless misuse. It will not stop a determined adversary, and it
 *   is not trying to. Anyone who wants to route around a regex can. The point is
 *   that the tool does not quietly assist with the small number of things that
 *   have no place in a penetration test, and that the list is published rather
 *   than secret.
 *
 * The categories match SECURITY.md verbatim. Changing them is a documentation
 * change as much as a code change.
 */

export type RefusalCategory =
  | "cbrn-weapons"
  | "csam"
  | "functional-malware"
  | "credential-phishing"
  | "targeted-harassment";

interface Rule {
  readonly category: RefusalCategory;
  readonly label: string;
  readonly pattern: RegExp;
}

const RULES: readonly Rule[] = [
  {
    category: "cbrn-weapons",
    label: "chemical, biological, radiological, nuclear or weapons synthesis",
    pattern:
      /\b(synthesi[sz]e|manufactur\w*|produce|make|build)\b[^.]{0,60}\b(nerve agent|sarin|vx|tabun|ricin|anthrax|smallpox|weapons?[- ]grade|enriched uranium|plutonium|dirty bomb|pipe bomb|ied|explosive device)\b/i,
  },
  {
    category: "csam",
    label: "sexual content involving minors",
    pattern: /\b(child|minor|underage|preteen|toddler)\b[^.]{0,40}\b(sexual|porn\w*|nude|erotic|explicit)\b|\bcsam\b/i,
  },
  {
    category: "functional-malware",
    label: "working malware, ransomware or exploit code",
    pattern:
      /\b(write|generate|produce|give me|create)\b[^.]{0,50}\b(ransomware|keylogger|rootkit|botnet|worm|working exploit|weaponi[sz]ed exploit|0-?day|zero-?day exploit)\b[^.]{0,40}\b(code|payload|implant|source)\b/i,
  },
  {
    category: "credential-phishing",
    label: "a credential-phishing kit targeting a named institution",
    pattern:
      /\b(phishing|credential harvest\w*)\b[^.]{0,50}\b(page|kit|clone|landing|portal)\b[^.]{0,60}\b(bank|paypal|microsoft 365|office ?365|okta|gmail|chase|hsbc|barclays)\b/i,
  },
  {
    category: "targeted-harassment",
    label: "harassment or doxxing of a named private individual",
    pattern:
      /\b(dox|doxx\w*)\b|\b(home address|social security number|ssn|private phone)\b[^.]{0,40}\bof\b[^.]{0,30}\b(my ex|my neighbou?r|this person|her|him)\b/i,
  },
];

export interface ScreenResult {
  readonly allowed: boolean;
  readonly category?: RefusalCategory;
  readonly label?: string;
}

export function screenPayload(text: string): ScreenResult {
  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      return { allowed: false, category: rule.category, label: rule.label };
    }
  }
  return { allowed: true };
}

export class RefusedPayloadError extends Error {
  constructor(readonly result: ScreenResult) {
    super(
      `Refusing to build this payload: it reads as a request for ${result.label}.\n` +
        `This is one of five published categories in SECURITY.md that JANUS will not help with.\n` +
        `The check is a regex and it is bypassable — that is not a hint, it is a statement that\n` +
        `the control here is thin and deliberate. If this is a false positive on legitimate test\n` +
        `text, rephrase it; the tool is not trying to guess your intent.`,
    );
    this.name = "RefusedPayloadError";
  }
}

/** The published list, exported so SECURITY.md and the code cannot drift apart. */
export const REFUSAL_CATEGORIES: readonly { category: RefusalCategory; label: string }[] =
  RULES.map((r) => ({ category: r.category, label: r.label }));
