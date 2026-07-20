// De-vig: convert a bookmaker's raw implied probabilities (which sum to more
// than 1 because of the overround) into margin-adjusted probabilities.
// Pluggable by design. Phase 1 ships the proportional method only.
export function devig(method, rawProbs) {
  switch (method || 'proportional') {
    case 'proportional': {
      const overround = rawProbs.reduce((a, b) => a + b, 0);
      if (overround <= 0) throw new Error('devig: probabilities must be positive');
      return rawProbs.map(p => p / overround);
    }
    // case 'power':  phase 2 — better long-odds accuracy
    // case 'shin':   phase 2
    default:
      throw new Error(`devig: unknown method "${method}"`);
  }
}

export function median(xs) {
  if (!xs.length) throw new Error('median of empty array');
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Consensus across bookmakers for one market:
// de-vig each book independently, take the median per outcome, then
// renormalise so the consensus sums to 1 across outcomes.
export function consensus(perBookRawProbs /* [{book, outcomes:[{name, price}]}] */) {
  const perBook = perBookRawProbs.map(b => {
    const raw = b.outcomes.map(o => 1 / o.price);
    const trued = devig('proportional', raw);
    return {
      book: b.book,
      overround: raw.reduce((a, x) => a + x, 0) - 1,
      outcomes: b.outcomes.map((o, i) => ({ name: o.name, price: o.price, p: trued[i] })),
    };
  });
  const byOutcome = {};
  for (const b of perBook) {
    for (const o of b.outcomes) (byOutcome[o.name] ??= []).push(o.p);
  }
  const medians = Object.entries(byOutcome).map(([name, ps]) => [name, median(ps)]);
  const total = medians.reduce((a, [, p]) => a + p, 0);
  const probs = Object.fromEntries(medians.map(([name, p]) => [name, p / total]));
  return { probs, perBook, books: perBook.length };
}
