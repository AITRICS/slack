const Logger = require('./logger');

/**
 * GitHub 멘션을 Slack 멘션으로 변환하는 유틸리티
 * 의존성 주입 패턴을 사용하여 외부 서비스와의 결합도를 낮춤
 */
class MentionUtils {
  /**
   * 코멘트 본문에서 GitHub 멘션 추출
   * @static
   * @param {string} text - 분석할 텍스트
   * @returns {string[]} GitHub 사용자명 목록
   */
  static extractGitHubMentions(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // @ 뒤의 영문자, 숫자, 하이픈, 언더스코어만 추출
    const mentionPattern = /@([a-zA-Z0-9_-]+)/g;

    const mentions = [...text.matchAll(mentionPattern)]
      .map(([, username]) => username)
      .filter((username) => username && username.length > 0);

    return [...new Set(mentions)]; // 중복 제거
  }

  /**
   * 정규표현식 특수문자 이스케이프 처리
   * @private
   * @static
   * @param {string} str - 이스케이프할 문자열
   * @returns {string} 이스케이프된 문자열
   */
  static #escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * GitHub 멘션을 Slack 멘션으로 변환
   * @static
   * @param {string} text - 변환할 텍스트
   * @param {Map<string, string>} githubToSlackMap - GitHub 사용자명 → Slack ID 매핑
   * @returns {string} 변환된 텍스트
   */
  static convertMentionsToSlack(text, githubToSlackMap) {
    if (!text || typeof text !== 'string') return text;
    if (!githubToSlackMap || githubToSlackMap.size === 0) return text;

    const escapedUsernames = [...githubToSlackMap.keys()]
      .map(MentionUtils.#escapeRegex);

    if (escapedUsernames.length === 0) return text;

    // 멘션 패턴: @username 뒤에 공백, 문장 끝, 구두점이 오는 경우
    const mentionPattern = new RegExp(
      `@(${escapedUsernames.join('|')})(?=$|\\s|[.,?!:;"'\\-()\\[\\]{}])`,
      'g',
    );

    let conversionCount = 0;

    const convertedText = text.replace(mentionPattern, (match, username) => {
      conversionCount += 1;
      return `<@${githubToSlackMap.get(username)}>`;
    });

    if (conversionCount > 0) {
      Logger.debug(`GitHub 멘션 변환 완료: ${conversionCount}개`, {
        originalLength: text.length,
        convertedLength: convertedText.length,
      });
    }

    return convertedText;
  }

  /**
   * GitHub 사용자명들을 Slack ID로 매핑하는 함수
   * @static
   * @param {string[]} githubUsernames - GitHub 사용자명 목록
   * @param {Function} slackIdResolver - Slack ID 조회 함수 (usernames, property) => Promise<Map>
   * @returns {Promise<Map<string, string>>} GitHub 사용자명 → Slack ID 매핑
   */
  static async createGitHubToSlackMapping(githubUsernames, slackIdResolver) {
    try {
      if (!githubUsernames || githubUsernames.length === 0) {
        return new Map();
      }

      if (typeof slackIdResolver !== 'function') {
        throw new Error('slackIdResolver는 함수여야 합니다');
      }

      Logger.debug(`GitHub 멘션 매핑 시작: ${githubUsernames.join(', ')}`);

      const slackIdMap = await slackIdResolver(githubUsernames, 'id');

      // 변환 성공한 사용자만 필터링 (원본과 다른 경우)
      const successfulMappings = new Map();
      slackIdMap.forEach((slackId, githubUsername) => {
        if (slackId && slackId !== githubUsername) {
          successfulMappings.set(githubUsername, slackId);
        }
      });

      Logger.info(
        `GitHub → Slack 멘션 매핑 생성 완료: ${successfulMappings.size}/${githubUsernames.length}개 성공`,
      );

      return successfulMappings;
    } catch (error) {
      Logger.error('GitHub 멘션 매핑 생성 실패', error);
      throw error;
    }
  }

  /**
   * 코멘트 텍스트에서 GitHub 멘션을 Slack 멘션으로 변환 (통합 함수)
   * @static
   * @param {string} commentText - 코멘트 텍스트
   * @param {Function} slackIdResolver - Slack ID 조회 함수 (usernames, property) => Promise<Map>
   * @returns {Promise<string>} 변환된 코멘트 텍스트
   */
  static async convertCommentMentions(commentText, slackIdResolver) {
    try {
      const githubMentions = MentionUtils.extractGitHubMentions(commentText);

      if (githubMentions.length === 0) {
        return commentText;
      }

      const githubToSlackMap = await MentionUtils.createGitHubToSlackMapping(
        githubMentions,
        slackIdResolver,
      );

      return MentionUtils.convertMentionsToSlack(commentText, githubToSlackMap);
    } catch (error) {
      Logger.error('코멘트 멘션 변환 실패', error);
      return commentText; // 실패 시 원본 반환
    }
  }
}

module.exports = MentionUtils;
