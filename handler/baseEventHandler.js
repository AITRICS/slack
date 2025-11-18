const Logger = require('../utils/logger');
const { PayloadValidationError } = require('../utils/errors');
/**
 * 이벤트 핸들러 기본 클래스
 */
class BaseEventHandler {
  /**
   * @param {EventHandlerServices} services - 주입된 서비스들
   */
  constructor(services) {
    const required = [
      'gitHubApiHelper',
      'slackUserService',
      'slackChannelService',
      'slackMessageService',
    ];

    const missing = required.filter((service) => !services[service]);
    if (missing.length > 0) {
      throw new Error(`필수 서비스가 누락되었습니다: ${missing.join(', ')}`);
    }

    this.gitHubApiHelper = services.gitHubApiHelper;
    this.slackUserService = services.slackUserService;
    this.slackChannelService = services.slackChannelService;
    this.slackMessageService = services.slackMessageService;
    this.initialized = false;
  }

  /**
   * 핸들러 초기화 (필요시 오버라이드)
   * @protected
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    Logger.debug(`${this.constructor.name} 초기화 중...`);
    this.initialized = true;
    Logger.debug(`${this.constructor.name} 초기화 완료`);
  }

  /**
   * 페이로드 검증
   * @protected
   * @static
   * @param {Object} payload - GitHub webhook 페이로드
   * @throws {PayloadValidationError} 페이로드가 유효하지 않은 경우
   */
  static validatePayload(payload) {
    if (!payload) {
      throw new PayloadValidationError('페이로드가 없습니다');
    }

    if (!payload.repository) {
      throw new PayloadValidationError('repository 정보가 없습니다', payload);
    }
  }

  /**
   * 저장소 정보 추출
   * @protected
   * @static
   * @param {GitHubRepository} repository - GitHub repository 객체
   * @returns {{name: string, fullName: string, url: string}} 저장소 정보
   */
  static extractRepoData(repository) {
    return {
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
    };
  }

  /**
   * PR의 모든 리뷰어 조회 (개별 + 팀 + 실제 리뷰어)
   * @protected
   * @param {string} repoName - 저장소 이름
   * @param {number} prNumber - PR 번호
   * @param {GitHubPullRequest} prDetails - PR 상세 정보 (필수)
   * @returns {Promise<string[]>} GitHub 사용자명 목록
   */
  async fetchAllReviewers(repoName, prNumber, prDetails) {
    const reviews = await this.gitHubApiHelper.fetchPullRequestReviews(repoName, prNumber);

    Logger.debug('PR 리뷰어 조회 시작', {
      repoName,
      prNumber,
      author: prDetails.user?.login,
      requestedReviewersCount: prDetails.requested_reviewers?.length || 0,
      requestedTeamsCount: prDetails.requested_teams?.length || 0,
      reviewsCount: reviews.length,
    });

    // 1. 개별 요청된 리뷰어
    const requestedReviewers = (prDetails.requested_reviewers || []).map((r) => r.login);

    // 2. 팀으로 요청된 리뷰어 처리
    const teamMembers = await this.fetchTeamMembers(prDetails.requested_teams || []);

    // 3. 실제 리뷰한 사람
    const actualReviewers = reviews.map((review) => review.user.login);

    // 4. 모든 리뷰어 통합 (중복 제거)
    const allReviewerUsernames = [...new Set([
      ...requestedReviewers,
      ...teamMembers,
      ...actualReviewers,
    ])];

    Logger.debug('모든 리뷰어 조회 완료', {
      repoName,
      prNumber,
      individualReviewers: requestedReviewers.length,
      teamReviewers: teamMembers.length,
      actualReviewers: actualReviewers.length,
      totalUnique: allReviewerUsernames.length,
    });

    return allReviewerUsernames;
  }

  /**
   * 팀 멤버 조회
   * @protected
   * @param {Array<{slug: string}>} requestedTeams - 요청된 팀 목록
   * @returns {Promise<string[]>} 팀 멤버 GitHub 사용자명 목록
   */
  async fetchTeamMembers(requestedTeams) {
    if (!requestedTeams || requestedTeams.length === 0) {
      return [];
    }

    const teamMemberPromises = requestedTeams.map(async (team) => {
      try {
        const members = await this.gitHubApiHelper.fetchTeamMembers(team.slug);
        Logger.debug(`팀 멤버 조회 성공: ${team.slug} (${members.length}명)`);
        return members.map((member) => member.login);
      } catch (error) {
        Logger.warn(`팀 멤버 조회 실패: ${team.slug}`, error);
        return [];
      }
    });

    const teamMembersArrays = await Promise.all(teamMemberPromises);
    return teamMembersArrays.flat();
  }
}

module.exports = BaseEventHandler;
