/**
 * LocalStorage utilities for TimeAlign
 * Stores: puzzle state per date ID
 */

const STORAGE_KEY = 'timealign_puzzle_';

/**
 * Save puzzle attempt result to LocalStorage
 * @param {string} puzzleId - The date/puzzle ID
 * @param {object} result - { success, attemptsUsed, order, factsIndexed }
 */
export function saveAttempt(puzzleId, result) {
  try {
    const key = `${STORAGE_KEY}${puzzleId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '{"attempts":[], "completed": false}');
    const updated = {
      attempts: [...existing.attempts, result],
      completed: result.success || existing.completed,
    };
    localStorage.setItem(key, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('LocalStorage save failed', e);
    return null;
  }
}

/**
 * Get puzzle attempt history from LocalStorage
 * @param {string} puzzleId - The date/puzzle ID
 * @returns {object} { attempts: array, completed: boolean }
 */
export function getAttemptHistory(puzzleId) {
  try {
    const key = `${STORAGE_KEY}${puzzleId}`;
    const data = JSON.parse(localStorage.getItem(key) || '{"attempts":[], "completed": false}');
    return {
      attempts: data.attempts || [],
      completed: data.completed || false,
    };
  } catch (e) {
    console.warn('LocalStorage read failed', e);
    return { attempts: [], completed: false };
  }
}

/**
 * Check if user has already completed this puzzle
 * @param {string} puzzleId - The date/puzzle ID
 * @returns {boolean} true if already completed
 */
export function isPuzzleCompleted(puzzleId) {
  return getAttemptHistory(puzzleId).completed;
}

/**
 * Get the last attempt result
 * @param {string} puzzleId - The date/puzzle ID
 * @returns {object|null} last attempt result or null
 */
export function getLastAttempt(puzzleId) {
  const history = getAttemptHistory(puzzleId);
  if (history.attempts.length === 0) return null;
  return history.attempts[history.attempts.length - 1];
}