const { SLACK_CONFIG, USER_PRIORITY_MAPPING } = require('../constants');
const Logger = require('./logger');

/**
 * 이름을 정규화 (공백 제거, 괄호 내용 제거, 밑줄 뒤 내용 제거, 소문자 변환)
 * @param {string} rawName
 * @returns {string}
 */
function normalizeUserName(rawName = '') {
  if (!rawName || typeof rawName !== 'string') return '';

  const cleaned = rawName
    .trim()
    .replace(/\s*\(.*?\)$/, '') // 괄호 제거
    .replace(/_.*$/, '') // 밑줄 뒤 제거
    .replace(/\s+/g, ''); // 공백 제거

  // 한글이 있으면 한글만 추출
  if (/[가-힣]/.test(cleaned)) {
    return (cleaned.match(/[가-힣]+/g) || []).join('');
  }

  // 영문자가 있으면 영문자만 추출하고 소문자로 변환
  if (/[a-zA-Z]/.test(cleaned)) {
    return (cleaned.match(/[a-zA-Z]+/g) || []).join('').toLowerCase();
  }

  // 숫자만 있으면 빈 문자열 반환
  return '';
}

/**
 * Slack 사용자 객체에서 지정된 속성 추출
 * @param {Object} slackUser
 * @param {'id'|'realName'} property
 * @returns {string}
 */
function getSlackUserProperty(slackUser, property) {
  const normalizedProperty = property ? property.toLowerCase() : '';

  switch (normalizedProperty) {
    case 'id':
      return slackUser.id;
    case 'realname':
      return slackUser.profile?.display_name || slackUser.real_name;
    default:
      return slackUser.real_name;
  }
}

/**
 * 사용자가 스킵 대상인지 확인 (개선된 정확한 매칭)
 * @param {Object} slackUser
 * @param {Array} skipUsers - 테스트용 옵션 파라미터
 * @returns {boolean}
 */
function shouldSkipUser(slackUser, skipUsers = null) {
  const candidateNames = [
    slackUser.real_name,
    slackUser.profile?.display_name,
  ].filter(Boolean);

  const actualSkipUsers = skipUsers || SLACK_CONFIG.SKIP_USERS;

  if (!actualSkipUsers || !Array.isArray(actualSkipUsers)) {
    return false;
  }

  // 원본 이름으로 정확히 매칭되는 경우에만 스킵
  return candidateNames.some((name) => actualSkipUsers.includes(name));
}

/**
 * 단일 사용자에 대한 매칭 후보 생성 (완전 일치만)
 * @param {Object} slackUser
 * @param {string} normalizedSearchName
 * @returns {Array} 매칭 후보 배열
 */
function createMatchCandidates(slackUser, normalizedSearchName) {
  if (slackUser.deleted || shouldSkipUser(slackUser)) {
    return [];
  }

  const candidateNames = [
    slackUser.real_name,
    slackUser.profile?.display_name,
  ].filter(Boolean);

  const uniqueCandidateNames = [...new Set(candidateNames)];

  return uniqueCandidateNames
    .map((candidateName) => {
      const normalizedCandidate = normalizeUserName(candidateName);
      if (!normalizedCandidate || !normalizedSearchName) return null;

      if (normalizedCandidate === normalizedSearchName) {
        return {
          user: slackUser,
          matchedName: candidateName,
          matchType: 'exact',
        };
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * 모든 Slack 사용자에서 매칭 후보 수집 (완전 일치만)
 * @param {Array} slackMembers
 * @param {string} normalizedSearchName
 * @returns {Object} {exactMatches: Array}
 */
function collectAllMatches(slackMembers, normalizedSearchName) {
  const allCandidates = slackMembers.flatMap(
    (slackUser) => createMatchCandidates(slackUser, normalizedSearchName),
  );

  const exactMatches = allCandidates.filter((candidate) => candidate.matchType === 'exact');

  return { exactMatches };
}

/**
 * 우선순위 매핑을 적용하여 매칭 선택
 * @param {string} githubRealName
 * @param {Array} slackMembers
 * @param {'id'|'realName'} property
 * @returns {string|null} 우선순위 매핑 결과 또는 null
 */
function checkPriorityMapping(githubRealName, slackMembers, property) {
  const prioritySlackName = USER_PRIORITY_MAPPING[githubRealName];

  if (!prioritySlackName) {
    return null;
  }

  // 우선순위 매핑된 사용자 찾기 (정규화 없이 원본 이름으로 비교)
  const priorityUser = slackMembers.find((slackUser) => {
    if (slackUser.deleted || shouldSkipUser(slackUser)) {
      return false;
    }

    const candidateNames = [
      slackUser.real_name,
      slackUser.profile?.display_name,
    ].filter(Boolean);

    return candidateNames.includes(prioritySlackName);
  });

  if (priorityUser) {
    Logger.info('우선순위 매핑 적용', {
      githubRealName,
      prioritySlackName,
      selectedUserId: priorityUser.id,
    });

    return getSlackUserProperty(priorityUser, property);
  }

  Logger.warn('우선순위 매핑된 사용자를 찾을 수 없음', {
    githubRealName,
    prioritySlackName,
  });

  return null;
}

/**
 * 매칭 결과에서 최적의 매치 선택
 * @param {Object} matches - {exactMatches, startsWithMatches}
 * @param {string} githubRealName
 * @returns {Object|null} 선택된 매칭 또는 null
 */
function selectBestMatch(matches, githubRealName) {
  const { exactMatches } = matches;

  if (exactMatches.length > 0) {
    if (exactMatches.length > 1) {
      Logger.warn('여러 완전 일치 발견, 첫 번째 사용', {
        githubRealName,
        matches: exactMatches.map((m) => ({
          id: m.user.id,
          name: m.matchedName,
          realName: m.user.real_name,
          displayName: m.user.profile?.display_name,
        })),
      });
    }
    return exactMatches[0];
  }

  return null;
}

/**
 * GitHub 실명으로 Slack 사용자 속성 조회
 * @param {Array} slackMembers - Slack 사용자 목록
 * @param {string} githubRealName - GitHub 실명
 * @param {'id'|'realName'} property - 조회할 속성
 * @returns {string} 조회된 속성값 또는 원본 이름
 */
function findSlackUserProperty(slackMembers, githubRealName, property) {
  Logger.debug('사용자 매칭 시작', {
    githubRealName,
    property,
  });

  // 0. 검색하려는 이름 자체가 skip 대상인지 확인
  const actualSkipUsers = SLACK_CONFIG.SKIP_USERS || [];
  if (actualSkipUsers.includes(githubRealName)) {
    Logger.warn('검색 대상이 스킵 사용자', {
      githubRealName,
    });
    return githubRealName;
  }

  // 1. 우선순위 매핑 확인 (정규화 없이)
  const priorityResult = checkPriorityMapping(githubRealName, slackMembers, property);
  if (priorityResult) {
    return priorityResult;
  }

  // 2. 일반 매칭 진행
  const normalizedSearchName = normalizeUserName(githubRealName);

  // 정규화된 이름이 빈 문자열이면 원본 반환
  if (!normalizedSearchName) {
    Logger.warn('정규화된 이름이 빈 문자열', {
      githubRealName,
    });
    return githubRealName;
  }

  Logger.debug('정규화된 검색명', {
    githubRealName,
    normalizedSearchName,
  });

  // 3. 매칭 후보 수집
  const matches = collectAllMatches(slackMembers, normalizedSearchName);

  Logger.debug('매칭 결과', {
    githubRealName,
    exactMatches: matches.exactMatches.length,
    exactUsers: matches.exactMatches.map((m) => ({ id: m.user.id, name: m.matchedName })),
  });

  // 4. 최적 매칭 선택
  const selectedMatch = selectBestMatch(matches, githubRealName);

  if (!selectedMatch) {
    Logger.warn('매칭되는 Slack 사용자 없음', {
      githubRealName,
      normalizedSearchName,
    });
    return githubRealName;
  }

  const result = getSlackUserProperty(selectedMatch.user, property);

  Logger.info('사용자 매칭 완료', {
    githubRealName,
    slackUserId: selectedMatch.user.id,
    slackRealName: selectedMatch.user.real_name,
    matchedName: selectedMatch.matchedName,
    matchType: selectedMatch.matchType,
    property,
    result,
  });

  return result;
}

module.exports = {
  findSlackUserProperty,
  // 두개의 함수는 테스트 코드를 위한 exports.
  normalizeUserName,
  shouldSkipUser,
};
