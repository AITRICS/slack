const { SLACK_CONFIG, USER_PRIORITY_MAPPING } = require('../constants');
const Logger = require('./logger');

/**
 * 이름을 정규화 (공백 제거, 괄호 내용 제거, 밑줄 뒤 내용 제거, 소문자 변환)
 * @param {string} rawName
 * @returns {string}
 */
function normalizeUserName(rawName = '') {
  // null, undefined 체크 추가
  if (!rawName || typeof rawName !== 'string') {
    return '';
  }

  return rawName
    .trim()
    .replace(/\s*\(.*?\)$/, '') // 괄호와 괄호 안 내용 제거 (공백 있든 없든)
    .replace(/_.*$/, '') // 밑줄(_) 뒤의 모든 내용 제거 (별명 처리)
    .replace(/\s+/g, '') // 모든 공백 제거 (한국어 이름에서 공백 있을 수 있음)
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

  // 테스트용 파라미터가 있으면 사용, 없으면 constants에서 가져오기
  const actualSkipUsers = skipUsers || SLACK_CONFIG.SKIP_USERS;

  if (!actualSkipUsers || !Array.isArray(actualSkipUsers)) {
    return false;
  }

  // 원본 이름으로도 체크하고, 정규화된 이름으로도 체크
  return candidateNames.some((name) => {
    // 1. 원본 이름 그대로 스킵 리스트에 있는지 확인
    if (actualSkipUsers.includes(name)) {
      return true;
    }

    // 2. 정규화된 이름끼리 완전 일치 확인
    const normalizedName = normalizeUserName(name);
    return actualSkipUsers.some((skipName) => {
      const normalizedSkipName = normalizeUserName(skipName);
      return normalizedName === normalizedSkipName;
    });
  });
}

/**
 * 단일 사용자에 대한 매칭 후보 생성
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

  return candidateNames
    .map((candidateName) => {
      const normalizedCandidate = normalizeUserName(candidateName);

      // 완전 일치 확인
      if (normalizedCandidate === normalizedSearchName) {
        return {
          user: slackUser,
          matchedName: candidateName,
          matchType: 'exact',
        };
      }

      // 시작 부분 일치 확인 (최소 2글자 이상)
      if (normalizedCandidate.startsWith(normalizedSearchName) &&
        normalizedSearchName.length >= 2) {
        return {
          user: slackUser,
          matchedName: candidateName,
          matchType: 'startsWith',
        };
      }

      return null;
    })
    .filter(Boolean);
}

/**
 * 모든 Slack 사용자에서 매칭 후보 수집
 * @param {Array} slackMembers
 * @param {string} normalizedSearchName
 * @returns {Object} {exactMatches: Array, startsWithMatches: Array}
 */
function collectAllMatches(slackMembers, normalizedSearchName) {
  const allCandidates = slackMembers.flatMap(
    (slackUser) => createMatchCandidates(slackUser, normalizedSearchName),
  );

  const exactMatches = allCandidates.filter((candidate) => candidate.matchType === 'exact');
  const startsWithMatches = allCandidates.filter((candidate) => candidate.matchType === 'startsWith');

  return { exactMatches, startsWithMatches };
}

/**
 * 우선순위 매핑을 적용하여 매칭 선택
 * @param {Array} startsWithMatches
 * @param {string} githubRealName
 * @returns {Object|null} 선택된 매칭 또는 null
 */
function applyPriorityMapping(startsWithMatches, githubRealName) {
  const prioritySlackName = USER_PRIORITY_MAPPING[githubRealName];

  if (!prioritySlackName) {
    // 우선순위 매핑이 없을 때 한 번만 경고
    Logger.warn('여러 시작 부분 일치 발견, 우선순위 매핑 없음', {
      githubRealName,
      matches: startsWithMatches.map((m) => ({
        id: m.user.id,
        name: m.matchedName,
        normalized: normalizeUserName(m.matchedName),
      })),
      suggestion: `USER_PRIORITY_MAPPING에 '${githubRealName}': '선호하는_Slack_이름' 추가 고려`,
    });
    return null;
  }

  const priorityMatch = startsWithMatches.find((match) => match.matchedName === prioritySlackName);

  if (!priorityMatch) {
    Logger.warn('우선순위 매핑된 사용자를 찾을 수 없음', {
      githubRealName,
      prioritySlackName,
      availableMatches: startsWithMatches.map((m) => m.matchedName),
    });
    return null;
  }

  Logger.info('우선순위 매핑 적용', {
    githubRealName,
    prioritySlackName,
    selectedUserId: priorityMatch.user.id,
  });

  return priorityMatch;
}

/**
 * 매칭 결과에서 최적의 매치 선택
 * @param {Object} matches - {exactMatches, startsWithMatches}
 * @param {string} githubRealName
 * @returns {Object|null} 선택된 매칭 또는 null
 */
function selectBestMatch(matches, githubRealName) {
  const { exactMatches, startsWithMatches } = matches;

  // 완전 일치 우선
  if (exactMatches.length > 0) {
    if (exactMatches.length > 1) {
      Logger.warn('여러 완전 일치 발견, 첫 번째 사용', {
        githubRealName,
        matches: exactMatches.map((m) => ({ id: m.user.id, name: m.matchedName })),
      });
    }
    return exactMatches[0];
  }

  // 시작 부분 일치 처리
  if (startsWithMatches.length === 1) {
    // 단일 매칭일 때는 우선순위 매핑 로그를 출력하지 않음
    return startsWithMatches[0];
  }

  if (startsWithMatches.length > 1) {
    return applyPriorityMapping(startsWithMatches, githubRealName);
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
  const normalizedSearchName = normalizeUserName(githubRealName);

  Logger.debug('사용자 매칭 시작', {
    githubRealName,
    normalizedSearchName,
    property,
  });

  // 1. 매칭 후보 수집
  const matches = collectAllMatches(slackMembers, normalizedSearchName);

  Logger.debug('매칭 결과', {
    githubRealName,
    exactMatches: matches.exactMatches.length,
    startsWithMatches: matches.startsWithMatches.length,
    exactUsers: matches.exactMatches.map((m) => ({ id: m.user.id, name: m.matchedName })),
    startsWithUsers: matches.startsWithMatches.map((m) => ({ id: m.user.id, name: m.matchedName })),
  });

  // 2. 최적 매칭 선택
  const selectedMatch = selectBestMatch(matches, githubRealName);

  if (!selectedMatch) {
    Logger.warn('매칭되는 Slack 사용자 없음', {
      githubRealName,
      normalizedSearchName,
    });
    return githubRealName;
  }

  const result = getSlackUserProperty(selectedMatch.user, property);

  // 성공 로그는 우선순위 매핑이 실제로 사용된 경우에만 상세 정보 포함
  const priorityMappingUsed = selectedMatch.matchType === 'startsWith' &&
    matches.startsWithMatches.length > 1 &&
    USER_PRIORITY_MAPPING[githubRealName];

  Logger.info('사용자 매칭 완료', {
    githubRealName,
    slackUserId: selectedMatch.user.id,
    slackRealName: selectedMatch.user.real_name,
    matchedName: selectedMatch.matchedName,
    matchType: selectedMatch.matchType,
    priorityMappingUsed,
    property,
    result,
  });

  return result;
}

module.exports = {
  normalizeUserName,
  findSlackUserProperty,
  shouldSkipUser, // 디버깅을 위해 export 추가
};
