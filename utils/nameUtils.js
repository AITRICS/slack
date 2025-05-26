const { SLACK_CONFIG } = require('../constants');

/**
 * 이름을 정규화 (공백 제거, 괄호 내용 제거, 소문자 변환)
 * @param {string} rawName
 * @returns {string}
 */
function normalizeUserName(rawName = '') {
  return rawName
    .trim()
    .replace(/\s*\(.*?\)$/, '') // 괄호와 괄호 안 내용 제거
    .toLowerCase();
}

/**
 * Slack 사용자 객체에서 지정된 속성 추출
 * @param {Object} slackUser
 * @param {'id'|'realName'} property
 * @returns {string}
 */
function getSlackUserProperty(slackUser, property) {
  const propertyExtractors = {
    id: () => slackUser.id,
    realName: () => slackUser.profile?.display_name || slackUser.real_name,
  };

  const extractor = propertyExtractors[property];
  return extractor ? extractor() : slackUser.real_name;
}

/**
 * GitHub 실명으로 Slack 사용자 속성 조회
 * @param {Array} slackMembers - Slack 사용자 목록
 * @param {string} githubRealName - GitHub 실명
 * @param {'id'|'realName'} property - 조회할 속성
 * @returns {string} 조회된 속성값 또는 원본 이름
 */
function findSlackUserProperty(slackMembers, githubRealName, property) {
  const normalizedSearchName = normalizeUserName(githubRealName);

  const matchedUser = slackMembers.find((slackUser) => {
    if (slackUser.deleted) return false;

    const candidateNames = [
      slackUser.real_name,
      slackUser.profile?.display_name,
    ].filter(Boolean);

    // 건너뛸 사용자 체크
    const shouldSkipUser = candidateNames.some(
      (name) => SLACK_CONFIG.SKIP_USERS.some(
        (skipName) => normalizeUserName(name).includes(normalizeUserName(skipName)),
      ),
    );

    if (shouldSkipUser) return false;

    // 이름 매칭 체크 (부분 문자열 포함 관계)
    return candidateNames.some((candidateName) => {
      const normalizedCandidate = normalizeUserName(candidateName);
      return normalizedCandidate.includes(normalizedSearchName)
        || normalizedSearchName.includes(normalizedCandidate);
    });
  });

  if (!matchedUser) return githubRealName;

  return getSlackUserProperty(matchedUser, property);
}

module.exports = {
  normalizeUserName,
  findSlackUserProperty,
};
