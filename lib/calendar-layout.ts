/**
 * Side-by-side layout for overlapping calendar events.
 *
 * Events that overlap in time (directly or through a chain of overlaps) form a
 * cluster. Within a cluster each event gets the first free column, and every
 * event in the cluster is drawn 1/cols of the width, so none hides another.
 * In a personal calendar any cluster with cols > 1 is a clash.
 */
export type TimedEvent = { id: string; start: number; end: number }
export type EventPosition = { col: number; cols: number }

export function layoutOverlaps(events: TimedEvent[]): Map<string, EventPosition> {
  const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end)
  const out = new Map<string, EventPosition>()

  let cluster: { id: string; col: number }[] = []
  let colEnds: number[] = []      // end time of the last event in each column
  let clusterEnd = -Infinity

  const flush = () => {
    const cols = colEnds.length
    for (const c of cluster) out.set(c.id, { col: c.col, cols })
    cluster = []
    colEnds = []
  }

  for (const e of sorted) {
    if (e.start >= clusterEnd && cluster.length) flush()
    let col = colEnds.findIndex(end => end <= e.start)
    if (col === -1) { col = colEnds.length; colEnds.push(e.end) } else colEnds[col] = e.end
    cluster.push({ id: e.id, col })
    clusterEnd = Math.max(cluster.length === 1 ? -Infinity : clusterEnd, e.end)
  }
  if (cluster.length) flush()
  return out
}
