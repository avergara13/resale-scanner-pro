const canVibrate =
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function"

function pulse(pattern: number | number[]) {
  if (!canVibrate) {
    return
  }

  navigator.vibrate(pattern)
}

export const haptics = {
  selection: () => pulse([10]),
  impactLight: () => pulse([15]),
  impactMedium: () => pulse([25]),
  impactHeavy: () => pulse([40]),
  notifSuccess: () => pulse([10, 50, 10]),
  notifWarning: () => pulse([20, 40, 20]),
  notifError: () => pulse([40, 60, 40]),
}
