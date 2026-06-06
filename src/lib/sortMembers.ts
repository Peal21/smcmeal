// Sort members by roll number (ascending). Empty/null rolls come last.
// Numeric rolls compared as numbers; falls back to string compare.
export function compareByRoll(a: any, b: any) {
  const ra = (a?.roll_number ?? '').toString().trim();
  const rb = (b?.roll_number ?? '').toString().trim();
  if (!ra && !rb) return (a?.full_name || '').localeCompare(b?.full_name || '');
  if (!ra) return 1;
  if (!rb) return -1;
  const na = Number(ra);
  const nb = Number(rb);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return ra.localeCompare(rb, undefined, { numeric: true });
}

export function sortByRoll<T>(list: T[]): T[] {
  return [...list].sort(compareByRoll as any);
}
