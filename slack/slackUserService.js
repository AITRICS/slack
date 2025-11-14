const Logger = require('../utils/logger');
const { findSlackUserProperty } = require('../utils/nameUtils');

/**
 * Slack 사용자 관리 서비스
 * 단순히 한 번 로드하고 재사용
 */
class SlackUserService {
  /**
   * @param {import('@slack/web-api').WebClient} slackWebClient - Slack WebClient
   * @param {import('../github/gitHubApiHelper')} gitHubApiHelper - GitHub API 헬퍼
   */
  constructor(slackWebClient, gitHubApiHelper) {
    this.slackWebClient = slackWebClient;
    this.gitHubApiHelper = gitHubApiHelper;
    this.slackUsers = null;
    this.loadingPromise = null;
  }

  /**
   * Slack 사용자 목록 로드 (한 번만)
   * @private
   * @returns {Promise<SlackUser[]>} Slack 사용자 목록
   */
  async #loadSlackUsers() {
    if (this.slackUsers) {
      return this.slackUsers;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.#fetchSlackUsers();
    this.slackUsers = await this.loadingPromise;
    return this.slackUsers;
  }

  /**
   * Slack API에서 사용자 목록 가져오기
   * @private
   * @returns {Promise<SlackUser[]>} Slack 사용자 목록
   * @throws {Error} 사용자 목록을 가져올 수 없는 경우
   */
  async #fetchSlackUsers() {
    try {
      Logger.info('Slack 사용자 목록 로드 중...');
      const { members } = await this.slackWebClient.users.list();
      Logger.info(`${members.length}명의 Slack 사용자 로드 완료`);
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
   * @returns {Promise<string>} Slack 속성값
   */
  async getSlackProperty(githubUsername, property) {
    if (!githubUsername) {
      return githubUsername;
    }

    try {
      const slackUsers = await this.#loadSlackUsers();
      const githubRealName = await this.gitHubApiHelper.fetchUserRealName(githubUsername);
      return findSlackUserProperty(slackUsers, githubRealName, property);
    } catch (error) {
      Logger.error(`${githubUsername}의 Slack 속성 조회 실패`, error);
      return githubUsername;
    }
  }

  /**
   * 여러 GitHub 사용자의 Slack 속성 일괄 조회
   * @param {string[]} githubUsernames - GitHub 사용자명 목록
   * @param {'id'|'realName'} property - 조회할 속성
   * @returns {Promise<Map<string, string>>} 사용자명-속성값 매핑
   */
  async getSlackProperties(githubUsernames, property) {
    const slackUsers = await this.#loadSlackUsers();
    const result = new Map();

    await Promise.all(
      githubUsernames.map(async (username) => {
        try {
          const githubRealName = await this.gitHubApiHelper.fetchUserRealName(username);
          const slackValue = findSlackUserProperty(slackUsers, githubRealName, property);
          result.set(username, slackValue);
        } catch (error) {
          Logger.error(`${username}의 Slack 속성 조회 실패`, error);
          result.set(username, username);
        }
      }),
    );

    return result;
  }

  /**
   * 수신자 목록에 Slack ID 추가
   * @param {{githubUsername: string}[]} recipients - 수신자 입력 목록
   * @returns {Promise<UserMappingResult[]>} Slack ID가 추가된 사용자 매핑 결과
   */
  async addSlackIdsToRecipients(recipients) {
    const githubUsernames = recipients.map((r) => r.githubUsername);
    const slackIdMap = await this.getSlackProperties(githubUsernames, 'id');

    return recipients.map((recipient) => ({
      githubUsername: recipient.githubUsername,
      slackId: slackIdMap.get(recipient.githubUsername) || recipient.githubUsername,
    }));
  }
}

module.exports = SlackUserService;
