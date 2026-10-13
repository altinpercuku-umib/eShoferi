// While an exam runs, the answers are saved on the device. On phones the browser
// often reloads or closes background tabs - this way nobody loses a half-finished exam.

const key = (attemptId) => `eshoferi-exam-${attemptId}`

export function loadProgress(attemptId) {
  try {
    return JSON.parse(localStorage.getItem(key(attemptId)))
  } catch {
    return null
  }
}

export function saveProgress(attemptId, progress) {
  try {
    localStorage.setItem(key(attemptId), JSON.stringify(progress))
  } catch {
    // Storage full or blocked: the exam still works, it just won't survive a reload.
  }
}

export function clearProgress(attemptId) {
  try {
    localStorage.removeItem(key(attemptId))
  } catch {
    // Nothing to clean up.
  }
}
