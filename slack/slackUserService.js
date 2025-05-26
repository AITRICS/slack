const Logger = require('../utils/logger');
const { findSlackUserProperty } = require('../utils/nameUtils');

/**
 * @typedef {import('../types').SlackUser} SlackUser
 * @typedef {import('@slack/web-api').WebClient} WebClient
 * @typedef {import('../github/gitHubApiHelper')} GitHubApiHelper
 */

/**
 * Slack 사용자 관리 서비스
 * GitHub 사용자와 Slack 사용자 매핑을 캐싱하여 성능 최적화
 */
class SlackUserService {
  /**
   * @param {WebClient} webClient - Slack Web API 클라이언트
   * @param {GitHubApiHelper} gitHubApiHelper - GitHub API 헬퍼
   */
  constructor(webClient, gitHubApiHelper) {
    this.webClient = webClient;
    this.gitHubApiHelper = gitHubApiHelper;
    this.slackUsers = null;
    this.userMappingCache = new Map(); // 캐시 키: "githubUsername:property"
    this.initialized = false;
  }

  /**
   * 서비스 초기화 - Slack 사용자 목록 사전 로드
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;

    try {
      Logger.info('Slack 사용자 캐시 초기화 중...');
      await this.loadSlackUsers();
      this.initialized = true;
      Logger.info('Slack 사용자 캐시 초기화 완료');
    } catch (error) {
      Logger.error('Slack 사용자 캐시 초기화 실패', error);
      // 초기화 실패해도 개별 호출로 폴백 가능하도록 에러를 던지지 않음
    }
  }

  /**
   * Slack 사용자 목록 로드 (캐싱됨)
   * @returns {Promise<SlackUser[]>}
   */
  async loadSlackUsers() {
    if (this.slackUsers) return this.slackUsers;

    try {
      const { members } = await this.webClient.users.list();
      this.slackUsers = members;
      Logger.info(`${members.length}명의 Slack 사용자 캐시됨`);
      return members;
    } catch (error) {
      Logger.error('Slack 사용자 목록 로드 실패', error);
      throw new Error('Slack 사용자 목록을 가져올 수 없습니다');
    }
  }

  /**
   * GitHub 사용자명으로 Slack 속성 조회
   * @param {string} githubUsername - GitHub 사용자명
   * @param {'id'|'realName'} property - 조회할 속성
   * @returns {Promise<string>} Slack 속성값 또는 GitHub 사용자명
   */
  async getSlackProperty(githubUsername, property) {
    if (!githubUsername) {
      Logger.error('유효하지 않은 GitHub 사용자명');
      return githubUsername;
    }

    const batch = await this.getSlackProperties([githubUsername], property);
    return batch.get(githubUsername) || githubUsername;
  }

  /**
   * 여러 GitHub 사용자의 Slack 속성 일괄 조회
   * @param {string[]} githubUsernames - GitHub 사용자명 배열
   * @param {'id'|'realName'} property - 조회할 속성
   * @returns {Promise<Map<string, string>>} GitHub 사용자명 -> Slack 속성 맵
   */
  async getSlackProperties(githubUsernames, property) {
    if (!this.initialized) await this.initialize();

    const result = new Map();
    const uncachedUsernames = [];

    // 캐시 확인
    githubUsernames.forEach((username) => {
      const cacheKey = `${username}:${property}`;
      if (this.userMappingCache.has(cacheKey)) {
        result.set(username, this.userMappingCache.get(cacheKey));
      } else {
        uncachedUsernames.push(username);
      }
    });

    // 모두 캐시에 있으면 바로 반환
    if (uncachedUsernames.length === 0) return result;

    // 캐시되지 않은 사용자들 처리
    try {
      const slackUsers = await this.loadSlackUsers();

      await Promise.all(
        uncachedUsernames.map(async (githubUsername) => {
          try {
            const githubRealName = await this.gitHubApiHelper.fetchUserRealName(githubUsername);
            const slackValue = findSlackUserProperty(slackUsers, githubRealName, property);

            // 캐시에 저장
            const cacheKey = `${githubUsername}:${property}`;
            this.userMappingCache.set(cacheKey, slackValue);
            result.set(githubUsername, slackValue);
          } catch (error) {
            Logger.error(`${githubUsername}의 Slack 속성 조회 실패`, error);
            result.set(githubUsername, githubUsername); // 폴백
          }
        }),
      );
    } catch (error) {
      Logger.error('Slack 속성 일괄 조회 실패', error);
      // 실패한 항목들은 GitHub 사용자명으로 폴백
      uncachedUsernames.forEach((username) => {
        result.set(username, username);
      });
    }

    return result;
  }

  /**
   * 수신자 목록에 Slack ID 추가
   * @param {Array<{githubUsername: string}>} recipients - 수신자 목록
   * @returns {Promise<Array<{githubUsername: string, slackId: string}>>}
   */
  async addSlackIdsToRecipients(recipients) {
    const githubUsernames = recipients.map((r) => r.githubUsername);
    const slackIdMap = await this.getSlackProperties(githubUsernames, 'id');

    return recipients.map((recipient) => ({
      ...recipient,
      slackId: slackIdMap.get(recipient.githubUsername) || recipient.githubUsername,
    }));
  }

  /**
   * 캐시 초기화
   */
  clearCache() {
    this.slackUsers = null;
    this.userMappingCache.clear();
    this.initialized = false;
    Logger.info('Slack 사용자 캐시 초기화됨');
  }

  /**
   * 캐시 통계 조회 (디버깅용)
   * @returns {{initialized: boolean, cachedUsersCount: number, mappingCount: number}}
   */
  getCacheStats() {
    return {
      initialized: this.initialized,
      cachedUsersCount: this.slackUsers ? this.slackUsers.length : 0,
      mappingCount: this.userMappingCache.size,
    };
  }
}

module.exports = SlackUserService;
