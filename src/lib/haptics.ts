/**
 * Progressive-enhancement haptics via navigator.vibrate.
 *
 * NOTE: navigator.vibrate is NOT supported on iOS Safari (all versions) or
 * WebKit-based browsers on iOS — calls are silently no-ops on iPhone/iPad.
 * Android Chrome supports it. Always author UI so it works without haptic
 * feedback; treat vibration as a subtle enhancement only.
 */
const canVibrate =
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function"

function pulse(pattern: number | number[]) {
  if (!canVibrate) {
    return
  }

  navigator.vibrate(pattern)
}

/**
 * Haptic feedback primitives. All calls are no-ops when vibration is
 * unsupported (iOS Safari, reduced-motion preference).
 *
 * - `selection` — lightweight tick for list selection, toggle
 * - `impactLight/Medium/Heavy` — physical collision feedback
 * - `notifSuccess/Warning/Error` — outcome confirmation
 *
 * `link` variant: use `selection` for navigation, never `impactHeavy`.
 * Heavy impact on a tap-through feels wrong on devices that do support it.
 */
export const haptics = {
  selection: () => pulse([10]),
  impactLight: () => pulse([15]),
  impactMedium: () => pulse([25]),
  impactHeavy: () => pulse([40]),
  notifSuccess: () => pulse([10, 50, 10]),
  notifWarning: () => pulse([20, 40, 20]),
  notifError: () => pulse([40, 60, 40]),
}
