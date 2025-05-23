/**
 * Calculates the duration in minutes between two dates.
 * @param {Date|string} startTime - The start time.
 * @param {Date|string} endTime - The end time.
 * @returns {number} The duration in minutes.
 */
function calculateDurationInMinutes(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return (end - start) / 60000;
}

/**
 * Formats duration in minutes to Korean format.
 * @param {number} totalMinutes - Total duration in minutes.
 * @returns {string} Formatted duration string.
 */
function formatDuration(totalMinutes) {
  const minutes = Math.floor(totalMinutes);
  const seconds = Math.round((totalMinutes - minutes) * 60);
  return `${minutes}분 ${seconds}초`;
}

module.exports = {
  calculateDurationInMinutes,
  formatDuration,
};
