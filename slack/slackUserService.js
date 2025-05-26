const Logger = require('../utils/logger');
const { findSlackUserProperty } = require('../utils/nameUtils');

/**
 * @typedef {Object} SlackUser
 * @property {string} id
 * @property {string} real_name
 * @property {boolean} deleted
 * @property {Object} profile
 * @property {string} profile.display_name
 */

/**
 * @typedef {Object} RecipientInput
 * @property {string} githubUsername
 */

/**
 * @typedef {Object} UserMappingResult
 * @property {string} githubUsername
 * @property {string} slackId
 */

/**
 * Slack 사용자 관리 서비스
 * GitHub 사용자와 Slack 사용자 간의 매핑을 캐싱하여 성능 최적화
 */
class SlackUserService {
  /**
   * @param {import('@slack/web-api').WebClient} slackWebClient
   * @param {import('../github/gitHubApiHelper')} gitHubApiHelper
   */
  constructor(slackWebClient, gitHubApiHelper) {
    this.slackWebClient = slackWebClient;
    this.gitHubApiHelper = gitHubApiHelper;
    this.slackUsers = null;
    this.userMappingCache = new Map(); // "githubUsername:property" -> slackValue
    this.isInitialized = false;
  }

  /**
   * 서비스 초기화 - Slack 사용자 목록 사전 로드
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      Logger.info('Slack 사용자 서비스 초기화 중...');
      await this.#loadSlackUsers();
      this.isInitialized = true;
      Logger.info('Slack 사용자 서비스 초기화 완료');
    } catch (error) {
      Logger.error('Slack 사용자 서비스 초기화 실패', error);
      // 초기화 실패해도 개별 호출로 폴백 가능
    }
  }

  /**
   * Slack 사용자 목록 로드
   * @private
   * @returns {Promise<SlackUser[]>}
   */
  async #loadSlackUsers() {
    if (this.slackUsers) return this.slackUsers;

    try {
      const { members } = await this.slackWebClient.users.list();
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
   * @param {string} githubUsername
   * @param {'id'|'realName'} property
   * @returns {Promise<string>}
   */
  async getSlackProperty(githubUsername, property) {
    if (!githubUsername) {
      Logger.error('GitHub 사용자명이 제공되지 않음');
      return githubUsername;
    }

    const resultMap = await this.getSlackProperties([githubUsername], property);
    return resultMap.get(githubUsername) || githubUsername;
  }

  /**
   * 여러 GitHub 사용자의 Slack 속성 일괄 조회
   * @param {string[]} githubUsernames
   * @param {'id'|'realName'} property
   * @returns {Promise<Map<string, string>>}
   */
  async getSlackProperties(githubUsernames, property) {
    if (!this.isInitialized) await this.initialize();

    const result = new Map();
    const uncachedUsernames = this.#separateCachedFromUncached(githubUsernames, property, result);

    if (uncachedUsernames.length === 0) return result;

    await this.#processUncachedUsers(uncachedUsernames, property, result);
    return result;
  }

  /**
   * 캐시된 사용자와 캐시되지 않은 사용자 분리
   * @private
   * @param {string[]} githubUsernames
   * @param {string} property
   * @param {Map} result
   * @returns {string[]} 캐시되지 않은 사용자명 목록
   */
  #separateCachedFromUncached(githubUsernames, property, result) {
    const uncachedUsernames = [];

    githubUsernames.forEach((username) => {
      const cacheKey = SlackUserService.#buildCacheKey(username, property);

      if (this.userMappingCache.has(cacheKey)) {
        result.set(username, this.userMappingCache.get(cacheKey));
      } else {
        uncachedUsernames.push(username);
      }
    });

    return uncachedUsernames;
  }

  /**
   * 캐시되지 않은 사용자들 처리
   * @private
   * @param {string[]} uncachedUsernames
   * @param {string} property
   * @param {Map} result
   */
  async #processUncachedUsers(uncachedUsernames, property, result) {
    try {
      const slackUsers = await this.#loadSlackUsers();

      await Promise.all(
        uncachedUsernames.map((githubUsername) => this.#processSingleUser(githubUsername, property, slackUsers, result)),
      );
    } catch (error) {
      Logger.error('Slack 속성 일괄 조회 실패', error);
      // 실패한 사용자들은 GitHub 사용자명으로 폴백
      uncachedUsernames.forEach((username) => result.set(username, username));
    }
  }

  /**
   * 단일 사용자 처리
   * @private
   * @param {string} githubUsername
   * @param {string} property
   * @param {SlackUser[]} slackUsers
   * @param {Map} result
   */
  async #processSingleUser(githubUsername, property, slackUsers, result) {
    try {
      const githubRealName = await this.gitHubApiHelper.fetchUserRealName(githubUsername);
      const slackValue = findSlackUserProperty(slackUsers, githubRealName, property);

      this.#cacheUserMapping(githubUsername, property, slackValue);
      result.set(githubUsername, slackValue);
    } catch (error) {
      Logger.error(`${githubUsername}의 Slack 속성 조회 실패`, error);
      result.set(githubUsername, githubUsername);
    }
  }

  /**
   * 수신자 목록에 Slack ID 추가
   * @param {RecipientInput[]} recipients
   * @returns {Promise<UserMappingResult[]>}
   */
  async addSlackIdsToRecipients(recipients) {
    const githubUsernames = recipients.map((r) => r.githubUsername);
    const slackIdMap = await this.getSlackProperties(githubUsernames, 'id');

    return recipients.map((recipient) => ({
      githubUsername: recipient.githubUsername,
      slackId: slackIdMap.get(recipient.githubUsername) || recipient.githubUsername,
    }));
  }

  /**
   * 캐시 키 생성
   * @private
   * @param {string} githubUsername
   * @param {string} property
   * @returns {string}
   */
  static #buildCacheKey(githubUsername, property) {
    return `${githubUsername}:${property}`;
  }

  /**
   * 사용자 매핑 캐시 저장
   * @private
   * @param {string} githubUsername
   * @param {string} property
   * @param {string} slackValue
   */
  #cacheUserMapping(githubUsername, property, slackValue) {
    const cacheKey = SlackUserService.#buildCacheKey(githubUsername, property);
    this.userMappingCache.set(cacheKey, slackValue);
  }

  /**
   * 캐시 초기화
   */
  clearCache() {
    this.slackUsers = null;
    this.userMappingCache.clear();
    this.isInitialized = false;
    Logger.info('Slack 사용자 캐시 초기화됨');
  }

  /**
   * 캐시 통계 조회
   * @returns {Object}
   */
  getCacheStats() {
    return {
      isInitialized: this.isInitialized,
      cachedUsersCount: this.slackUsers ? this.slackUsers.length : 0,
      mappingCacheSize: this.userMappingCache.size,
    };
  }
}

module.exports = SlackUserService;
