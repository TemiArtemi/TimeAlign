/**
 * Share result utilities for TimeAlign
 * Uses Clipboard API to copy result text
 */

/**
 * Format the attempt grid as emojis
 * @param {Array} attempts - Array of 'correct'/'incorrect' per position
 * @returns {string} Emoji grid string
 */
export function formatEmojiGrid(attempts) {
  // Map: correct -> 🟩, incorrect -> 🟥
  const emoji = attempts.map(pos => pos === 'correct' ? '🟩' : '🟥');
  return emoji.join('');
}

/**
 * Generate the share text for TimeAlign
 * @param {object} options - { puzzleId, attemptsUsed, attemptsHistory }
 * @returns {string} Share text ready for clipboard
 */
export function generateShareText({ puzzleId, attemptsUsed, attemptsHistory }) {
  const grid = formatEmojiGrid(attemptsHistory);
  return `⏳ TimeAlign ${puzzleId}\nIntentos: ${attemptsUsed}/3\n${grid}\n¿Puedes ordenar la historia? Juega en timealign.com`;
}

/**
 * Copy share text to clipboard with fallback
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} true if copied successfully
 */
export async function copyToClipboard(text) {
  try {
    // Modern browsers
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch (e) {
    console.error('Failed to copy to clipboard', e);
    return false;
  }
}