#!/bin/zsh
set -eu
cd "${0:A:h}/.."
test_file=$(mktemp -t zhikang-sleep).swift
trap 'rm -f "$test_file"' EXIT
cat ios/App/App/SleepIntervals.swift > "$test_file"
cat >> "$test_file" <<'SWIFT'
let base = Date(timeIntervalSince1970: 0)
func span(_ start: Double, _ end: Double) -> DateInterval {
    DateInterval(start: base.addingTimeInterval(start * 3600), end: base.addingTimeInterval(end * 3600))
}
let window = span(0, 12)
assert(mergedSleepHours([], window: window) == nil)
assert(mergedSleepHours([span(1, 4), span(2, 5), span(1, 4)], window: window) == 4)
assert(mergedSleepHours([span(-2, 2), span(11, 14)], window: window) == 3)
assert(mergedSleepHours([span(1, 3), span(3, 4), span(6, 8)], window: window) == 5)
assert(mergedSleepHours([span(13, 15)], window: window) == nil)
print("Sleep aggregation: 5 checks passed")
SWIFT
swift "$test_file"
