export interface Range {
  readonly start: number;
  readonly end: number;
}

export function inAnyRange(index: number, ranges: readonly Range[]): boolean {
  for (const r of ranges) if (index >= r.start && index < r.end) return true;
  return false;
}


/**
 * Rebuild text character-by-character while carrying locked ranges across.
 * `fn` receives each character and its index in the ORIGINAL string and returns
 * its replacement. Characters inside a locked range are passed through untouched.
 */
export function mapRanges(
  text: string,
  ranges: readonly Range[],
  fn: (ch: string, index: number) => string,
): { text: string; ranges: Range[] } {
  let out = "";
  const starts = new Map<number, number>();
  const ends = new Map<number, number>();
  ranges.forEach((r, i) => {
    starts.set(r.start, i);
    ends.set(r.end, i);
  });

  const newStart = new Array<number>(ranges.length).fill(0);
  const newEnd = new Array<number>(ranges.length).fill(0);

  for (let i = 0; i <= text.length; i++) {
    const s = starts.get(i);
    if (s !== undefined) newStart[s] = out.length;
    const e = ends.get(i);
    if (e !== undefined) newEnd[e] = out.length;
    if (i === text.length) break;
    const ch = text[i] as string;
    // Never hand a surrogate half to `fn` — inserting between the halves of an
    // astral character corrupts it. Pass those through untouched.
    const isSurrogate = ch.charCodeAt(0) >= 0xd800 && ch.charCodeAt(0) <= 0xdfff;
    out += inAnyRange(i, ranges) || isSurrogate ? ch : fn(ch, i);
  }

  return {
    text: out,
    ranges: ranges.map((_, i) => ({ start: newStart[i] as number, end: newEnd[i] as number })),
  };
}
