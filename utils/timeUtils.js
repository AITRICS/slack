/**
 * 두 날짜 간의 분 단위 지속 시간 계산
 * @param {Date|string} startTime - 시작 시간
 * @param {Date|string} endTime - 종료 시간
 * @returns {number} 분 단위 지속 시간
 */
function calculateDurationInMinutes(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return (end - start) / 60000;
}

/**
 * 분 단위 지속 시간을 한국어 형식으로 포맷
 * @param {number} totalMinutes - 전체 분 수
 * @returns {string} 포맷된 지속 시간 문자열
 */
function formatDuration(totalMinutes) {
  const minutes = Math.floor(totalMinutes);
  const seconds = Math.round((totalMinutes - minutes) * 60);

  if (seconds === 60) {
    return `${minutes + 1}분 0초`;
  }

  return `${minutes}분 ${seconds}초`;
}

module.exports = {
  calculateDurationInMinutes,
  formatDuration,
};
