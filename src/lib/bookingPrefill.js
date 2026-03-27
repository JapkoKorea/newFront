export const TOUR_BOOKING_PREFILL_KEY = 'tour_booking_prefill_v1'

export function saveTourBookingPrefill(payload) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(TOUR_BOOKING_PREFILL_KEY, JSON.stringify(payload))
  } catch {
    return
  }
}

export function loadTourBookingPrefill() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(TOUR_BOOKING_PREFILL_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearTourBookingPrefill() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(TOUR_BOOKING_PREFILL_KEY)
  } catch {
    return
  }
}
