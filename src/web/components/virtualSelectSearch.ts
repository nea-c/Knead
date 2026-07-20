export type VersionFilterRow<T extends { raw: string }> =
  | { type: 'heading', label: string }
  | { type: 'version', version: T }

export function matchesVirtualSelectQuery(candidate: string, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  const normalizedCandidate = candidate.toLowerCase()
  return tokens.every(token => normalizedCandidate.includes(token))
}

export function filterVersionRows<T extends { raw: string }>(
  rows: VersionFilterRow<T>[],
  query: string,
): VersionFilterRow<T>[] {
  if (!query.trim()) return rows

  const filteredRows: VersionFilterRow<T>[] = []
  let heading: Extract<VersionFilterRow<T>, { type: 'heading' }> | undefined

  for (const row of rows) {
    if (row.type === 'heading') {
      heading = row
      continue
    }
    if (!matchesVirtualSelectQuery(row.version.raw, query)) continue
    if (heading) {
      filteredRows.push(heading)
      heading = undefined
    }
    filteredRows.push(row)
  }

  return filteredRows
}
