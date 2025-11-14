const { SLACK_CHANNELS, GITHUB_CONFIG } = require('@/constants');
const Logger = require('@/utils/logger');

/**
 * Slack 채널 선택 서비스
 */
class SlackChannelService {
  /**
   * @param {import('../github/gitHubApiHelper')} gitHubApiHelper
   */
  constructor(gitHubApiHelper) {
    this.gitHubApiHelper = gitHubApiHelper;
    this.teamMembers = new Map(); // "teamSlug" -> Set<username>
    this.loadingPromise = null;
  }

  /**
   * GitHub 사용자명을 기반으로 Slack 채널 선택
   * @param {string} githubUsername - GitHub 사용자명
   * @returns {Promise<string>} Slack 채널 ID
   */
  async selectChannel(githubUsername) {
    if (!githubUsername) {
      return SLACK_CHANNELS.gitAny;
    }

    try {
      const teamSlug = await this.findUserTeamSlug(githubUsername);
      const channel = SLACK_CHANNELS[teamSlug] || SLACK_CHANNELS.gitAny;
      Logger.debug(`사용자 ${githubUsername} -> 팀 ${teamSlug || 'none'} -> 채널 ${channel}`);
      return channel;
    } catch (error) {
      Logger.error(`${githubUsername}의 채널 선택 실패`, error);
      return SLACK_CHANNELS.gitAny;
    }
  }

  /**
   * 사용자가 속한 팀 찾기
   * @param {string} githubUsername - GitHub 사용자명
   * @returns {Promise<TeamSlug|null>} 팀 슬러그 또는 null
   */
  async findUserTeamSlug(githubUsername) {
    await this.#loadTeamMembers();

    // for...of 대신 find() 사용
    const foundTeamSlug = GITHUB_CONFIG.TEAM_SLUGS.find((teamSlug) => {
      const members = this.teamMembers.get(teamSlug);
      return members && members.has(githubUsername);
    });

    return foundTeamSlug || null;
  }

  /**
   * 팀 멤버 정보 로드 (한 번만)
   * @private
   * @returns {Promise<void>}
   */
  async #loadTeamMembers() {
    if (this.teamMembers.size > 0) {
      return;
    }

    if (this.loadingPromise) {
      await this.loadingPromise;
      return;
    }

    this.loadingPromise = this.#fetchAllTeamMembers();
    await this.loadingPromise;
  }

  /**
   * 모든 팀의 멤버 정보 가져오기
   * @private
   * @returns {Promise<void>}
   * @throws {Error} 팀 멤버 정보를 가져올 수 없는 경우
   */
  async #fetchAllTeamMembers() {
    try {
      Logger.info('팀 멤버 정보 로드 중...');

      await Promise.all(
        GITHUB_CONFIG.TEAM_SLUGS.map(async (teamSlug) => {
          const members = await this.gitHubApiHelper.fetchTeamMembers(teamSlug);
          const memberSet = new Set(members.map(({ login }) => login));
          this.teamMembers.set(teamSlug, memberSet);
          Logger.info(`팀 ${teamSlug}: ${members.length}명`);
        }),
      );

      const totalMembers = Array.from(this.teamMembers.values())
        .reduce((sum, memberSet) => sum + memberSet.size, 0);
      Logger.info(`팀 멤버 정보 로드 완료: ${totalMembers}명`);
    } catch (error) {
      Logger.error('팀 멤버 정보 로드 실패', error);
      throw new Error('팀 멤버 정보를 가져올 수 없습니다');
    }
  }
}

module.exports = SlackChannelService;
