import Foundation

// Merge overlapping stages and sources before summing; clip to the query window.
func mergedSleepHours(_ intervals: [DateInterval], window: DateInterval) -> Double? {
    let clipped = intervals.compactMap { interval -> DateInterval? in
        let start = max(interval.start, window.start)
        let end = min(interval.end, window.end)
        return end > start ? DateInterval(start: start, end: end) : nil
    }.sorted { $0.start < $1.start }
    guard var current = clipped.first else { return nil }
    var total: TimeInterval = 0
    for interval in clipped.dropFirst() {
        if interval.start <= current.end {
            current = DateInterval(start: current.start, end: max(current.end, interval.end))
        } else {
            total += current.duration
            current = interval
        }
    }
    return (total + current.duration) / 3600
}
