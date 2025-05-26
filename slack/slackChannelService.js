const { SLACK_CHANNELS, GITHUB_CONFIG } = require('../constants');
const Logger = require('../utils/logger');
const { CacheError, SlackAPIError } = require('../utils/errors');
const environment = require('../config/environment');

/**
 * Slack 채널 선택 서비스
 * GitHub 팀 정보를 기반으로 적절한 Slack 채널을 선택
 */
class SlackChannelService {
  /**
   * @param {import('../github/gitHubApiHelper')} gitHubApiHelper
   */
  constructor(gitHubApiHelper) {
    this.gitHubApiHelper = gitHubApiHelper;

    // 캐싱 설정
    this.cacheEnabled = environment.isCachingEnabled();
    this.cacheExpiry = environment.get('features.cacheExpiry', 30 * 60 * 1000);

    // 캐시 저장소
    this.teamMembershipCache = new Map(); // "username" -> "teamSlug"
    this.teamMembersCache = new Map(); // "teamSlug" -> Set<username>
    this.lastCacheUpdate = new Map(); // "teamSlug" -> timestamp
  }

  /**
   * GitHub 사용자명을 기반으로 Slack 채널 선택
   * @param {string} githubUsername - GitHub 사용자명
   * @returns {Promise<string>} Slack 채널 ID
   */
  async selectChannel(githubUsername) {
    if (!githubUsername) {
      Logger.error('채널 선택을 위한 GitHub 사용자명이 없습니다');
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
   * @returns {Promise<string|null>} 팀 슬러그 또는 null
   */
  async findUserTeamSlug(githubUsername) {
    // 캐시 확인
    if (this.cacheEnabled && this.teamMembershipCache.has(githubUsername)) {
      const cachedTeam = this.teamMembershipCache.get(githubUsername);
      Logger.debug(`캐시에서 사용자 팀 조회: ${githubUsername} -> ${cachedTeam}`);
      return cachedTeam;
    }

    // 각 팀에서 사용자 찾기
    const teamChecks = await Promise.all(
      GITHUB_CONFIG.TEAM_SLUGS.map(async (teamSlug) => {
        try {
          const isMember = await this.isUserInTeam(githubUsername, teamSlug);
          return isMember ? teamSlug : null;
        } catch (error) {
          Logger.error(`팀 멤버십 확인 실패 (${teamSlug})`, error);
          return null;
        }
      }),
    );

    // 첫 번째로 찾은 팀 반환
    const userTeamSlug = teamChecks.find((slug) => slug !== null) || null;

    // 결과 캐싱
    if (this.cacheEnabled) {
      this.teamMembershipCache.set(githubUsername, userTeamSlug);
    }

    return userTeamSlug;
  }

  /**
   * 사용자가 특정 팀에 속해있는지 확인
   * @private
   * @param {string} githubUsername - GitHub 사용자명
   * @param {string} teamSlug - 팀 슬러그
   * @returns {Promise<boolean>}
   */
  async isUserInTeam(githubUsername, teamSlug) {
    // 팀 캐시가 만료되었는지 확인
    if (this.isCacheExpired(teamSlug)) {
      await this.refreshTeamCache(teamSlug);
    }

    // 캐시에서 확인
    const teamMembers = this.teamMembersCache.get(teamSlug);
    if (teamMembers) {
      return teamMembers.has(githubUsername);
    }

    // 캐시가 없으면 API 호출
    await this.refreshTeamCache(teamSlug);
    const updatedTeamMembers = this.teamMembersCache.get(teamSlug);
    return updatedTeamMembers ? updatedTeamMembers.has(githubUsername) : false;
  }

  /**
   * 캐시 만료 여부 확인
   * @private
   * @param {string} teamSlug - 팀 슬러그
   * @returns {boolean}
   */
  isCacheExpired(teamSlug) {
    if (!this.cacheEnabled) return true;

    const lastUpdate = this.lastCacheUpdate.get(teamSlug) || 0;
    return Date.now() - lastUpdate > this.cacheExpiry;
  }

  /**
   * 팀 멤버십 캐시 갱신
   * @private
   * @param {string} teamSlug - 팀 슬러그
   * @returns {Promise<void>}
   */
  async refreshTeamCache(teamSlug) {
    try {
      Logger.debug(`팀 캐시 갱신 중: ${teamSlug}`);

      const members = await this.gitHubApiHelper.fetchTeamMembers(teamSlug);
      const memberSet = new Set(members.map(({ login }) => login));

      // 캐시 업데이트
      if (this.cacheEnabled) {
        this.teamMembersCache.set(teamSlug, memberSet);
        this.lastCacheUpdate.set(teamSlug, Date.now());

        // 개별 사용자 캐시도 업데이트
        members.forEach(({ login }) => {
          // 이미 다른 팀에 속한 것으로 캐시되어 있지 않으면 업데이트
          if (!this.teamMembershipCache.has(login)) {
            this.teamMembershipCache.set(login, teamSlug);
          }
        });
      }

      Logger.info(`팀 캐시 갱신 완료: ${teamSlug} (${members.length}명)`);
    } catch (error) {
      const cacheError = new CacheError(
        `팀 캐시 갱신 실패: ${teamSlug}`,
        'refreshTeamCache',
      );
      cacheError.details = { teamSlug, originalError: error.message };
      throw cacheError;
    }
  }

  /**
   * 모든 팀 멤버십 사전 로드
   * @returns {Promise<void>}
   */
  async preloadTeamMemberships() {
    if (!this.cacheEnabled) {
      Logger.info('캐싱이 비활성화되어 있어 팀 멤버십 사전 로드를 건너뜁니다');
      return;
    }

    try {
      Logger.info('팀 멤버십 사전 로드 중...');
      Logger.time('팀 멤버십 로드');

      await Promise.all(
        GITHUB_CONFIG.TEAM_SLUGS.map((teamSlug) => this.refreshTeamCache(teamSlug)),
      );

      const totalMembers = Array.from(this.teamMembershipCache.values()).length;
      Logger.timeEnd('팀 멤버십 로드');
      Logger.info(`팀 멤버십 사전 로드 완료 (${GITHUB_CONFIG.TEAM_SLUGS.length}개 팀, ${totalMembers}명)`);
    } catch (error) {
      Logger.error('팀 멤버십 사전 로드 실패', error);
      // 실패해도 개별 조회는 가능하도록 에러를 던지지 않음
    }
  }

  /**
   * 캐시 초기화
   */
  clearCache() {
    this.teamMembershipCache.clear();
    this.teamMembersCache.clear();
    this.lastCacheUpdate.clear();
    Logger.info('팀 멤버십 캐시 초기화됨');
  }

  /**
   * 캐시 통계 조회
   * @returns {Object}
   */
  getCacheStats() {
    const stats = {
      cacheEnabled: this.cacheEnabled,
      userMappings: this.teamMembershipCache.size,
      teamCaches: this.teamMembersCache.size,
      cacheTimestamps: {},
    };

    // 각 팀의 캐시 정보
    this.lastCacheUpdate.forEach((timestamp, teamSlug) => {
      const age = Date.now() - timestamp;
      const memberCount = this.teamMembersCache.get(teamSlug)?.size || 0;
      stats.cacheTimestamps[teamSlug] = {
        lastUpdate: new Date(timestamp).toISOString(),
        ageMs: age,
        expired: age > this.cacheExpiry,
        memberCount,
      };
    });

    return stats;
  }

  /**
   * 특정 팀의 멤버 목록 조회
   * @param {string} teamSlug - 팀 슬러그
   * @returns {Promise<string[]>} 팀 멤버 사용자명 목록
   */
  async getTeamMembers(teamSlug) {
    if (this.isCacheExpired(teamSlug)) {
      await this.refreshTeamCache(teamSlug);
    }

    const members = this.teamMembersCache.get(teamSlug);
    return members ? Array.from(members) : [];
  }
}

module.exports = SlackChannelService;
