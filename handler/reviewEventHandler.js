const BaseEventHandler = require('./baseEventHandler');
const { REVIEW_STATES, GITHUB_CONFIG, SLACK_CHANNELS } = require('../constants');
const Logger = require('../utils/logger');

/**
 * 리뷰 이벤트 처리
 */
class ReviewEventHandler extends BaseEventHandler {
  /**
   * 승인 이벤트 처리
   * @param {ReviewPayload} payload GitHub webhook payload
   */
  async handleApprovalEvent(payload) {
    BaseEventHandler.validatePayload(payload);
    await this.initialize();

    const notification = ReviewEventHandler.#buildApprovalNotificationData(payload);

    const enriched = await this.#enrichWithSlackData({
      targetGh: notification.targetGithubUsername,
      authorGh: notification.authorGithubUsername,
    });

    const channelId = await this.slackChannelService.selectChannel(notification.targetGithubUsername);

    await this.slackMessageService.sendApprovalMessage({ ...notification, ...enriched }, channelId);
    Logger.info(`승인 알림 전송 완료: ${notification.targetGithubUsername}`);
  }

  /**
   * 리뷰 요청 이벤트 처리
   * @param {ReviewRequestPayload} payload GitHub webhook payload
   * @returns {Promise<void>}
   */
  async handleReviewRequestEvent(payload) {
    BaseEventHandler.validatePayload(payload);
    await this.initialize();

    const notification = ReviewEventHandler.#buildReviewRequestNotificationData(payload);

    const enriched = await this.#enrichWithSlackData({
      targetGh: notification.reviewerGithubUsername,
      authorGh: notification.targetGithubUsername,
    });

    const channelId = await this.slackChannelService.selectChannel(notification.reviewerGithubUsername);

    await this.slackMessageService.sendReviewRequestMessage({ ...notification, ...enriched }, channelId);
    Logger.info(`리뷰 요청 알림 전송 완료: ${notification.reviewerGithubUsername}`);
  }

  /**
   * 예약된 리뷰 알림 처리 (크론 트리거)
   * @param {Object} payload 저장소 정보를 포함한 페이로드
   * @returns {Promise<void>}
   */
  async handleScheduledReview(payload) {
    BaseEventHandler.validatePayload(payload);
    await this.initialize();

    const { repository: { name: repoName } } = payload;

    const open = await this.gitHubApiHelper.fetchOpenPullRequests(repoName);
    const nonDraft = open.filter((pr) => !pr.draft);

    const enrichedPrs = await this.#enrichPRsWithReviewStatus(nonDraft, repoName);
    const grouped = ReviewEventHandler.#groupPullRequestsByTeam(enrichedPrs);

    await this.#sendScheduledNotifications(grouped);
    Logger.info(`예약된 리뷰 알림 전송 완료: ${repoName}`);
  }

  /**
   * Slack 데이터로 알림 정보 보강
   * @private
   * @param {Object} params
   * @param {string} params.targetGh GitHub 사용자명 (멘션 대상)
   * @param {string} params.authorGh GitHub 사용자명 (이벤트 발생자)
   * @returns {Promise<{targetSlackId:string,authorSlackName:string}>}
   */
  async #enrichWithSlackData({ targetGh, authorGh }) {
    const usernames = [targetGh, authorGh];
    const [idMap, realNameMap] = await this.#fetchSlackMaps(usernames);

    return {
      targetSlackId: ReviewEventHandler.#getSlackMapValue(idMap, targetGh),
      authorSlackName: ReviewEventHandler.#getSlackMapValue(realNameMap, authorGh),
    };
  }

  /**
   * Slack ID 및 실명 맵 병렬 조회
   * @private
   * @param {string[]} ghUsernames GitHub 사용자명 목록
   * @returns {Promise<[Map<string,string>,Map<string,string>]>}
   */
  async #fetchSlackMaps(ghUsernames) {
    return Promise.all([
      this.slackUserService.getSlackProperties(ghUsernames, 'id'),
      this.slackUserService.getSlackProperties(ghUsernames, 'realName'),
    ]);
  }

  /**
   * Slack 맵에서 값 조회 (폴백 포함)
   * @private
   * @param {Map<string,string>} map Slack 매핑
   * @param {string} ghUsername GitHub 사용자명
   * @returns {string}
   */
  static #getSlackMapValue(map, ghUsername) {
    return map.get(ghUsername) || ghUsername;
  }

  /**
   * 승인 알림 데이터 생성
   * @private
   * @param {ReviewPayload} payload
   * @returns {Object}
   */
  static #buildApprovalNotificationData(payload) {
    return {
      commentUrl: payload.review.html_url,
      commentBody: payload.review.body || '',
      prUrl: payload.pull_request.html_url,
      prTitle: payload.pull_request.title,
      targetGithubUsername: payload.pull_request.user.login, // PR 작성자
      authorGithubUsername: payload.review.user.login, // 리뷰어
    };
  }

  /**
   * 리뷰 요청 알림 데이터 생성
   * @private
   * @param {ReviewRequestPayload} payload
   * @returns {Object}
   */
  static #buildReviewRequestNotificationData(payload) {
    return {
      prUrl: payload.pull_request.html_url,
      prTitle: payload.pull_request.title,
      targetGithubUsername: payload.pull_request.user.login, // PR 작성자
      reviewerGithubUsername: payload.requested_reviewer?.login,
    };
  }

  /**
   * PR 목록에 리뷰 상태 정보 추가
   * @private
   * @param {Array} pullRequests PR 목록
   * @param {string} repoName 저장소명
   * @returns {Promise<Array>}
   */
  async #enrichPRsWithReviewStatus(pullRequests, repoName) {
    return Promise.all(
      pullRequests.map(async (pr) => {
        const reviewersStatus = await this.#getReviewersWithStatus(repoName, pr.number);
        const statusString = ReviewEventHandler.#formatReviewersStatusString(reviewersStatus);
        const teamSlug = await this.slackChannelService.findUserTeamSlug(pr.user.login);

        return { ...pr, reviewersStatusString: statusString, teamSlug };
      }),
    );
  }

  /**
   * PR의 리뷰어 상태 조회
   * @private
   * @param {string} repoName 저장소명
   * @param {number} prNumber PR 번호
   * @returns {Promise<Object>}
   */
  async #getReviewersWithStatus(repoName, prNumber) {
    const [reviews, prDetails] = await Promise.all([
      this.gitHubApiHelper.fetchPullRequestReviews(repoName, prNumber),
      this.gitHubApiHelper.fetchPullRequestDetails(repoName, prNumber),
    ]);

    const submitted = reviews.map((r) => r.user.login);
    const requested = (prDetails.requested_reviewers || []).map((u) => u.login);
    const unique = [...new Set([...submitted, ...requested])];

    const idMap = await this.slackUserService.getSlackProperties(unique, 'id');
    const reviewersState = {};

    // 제출된 리뷰 상태 추가
    reviews.forEach((r) => {
      reviewersState[ReviewEventHandler.#getSlackMapValue(idMap, r.user.login)] = r.state || REVIEW_STATES.COMMENTED;
    });

    // 아직 리뷰하지 않은 요청받은 리뷰어 추가
    requested.forEach((gh) => {
      const slackId = ReviewEventHandler.#getSlackMapValue(idMap, gh);
      if (!reviewersState[slackId]) {
        reviewersState[slackId] = REVIEW_STATES.AWAITING;
      }
    });

    return reviewersState;
  }

  /**
   * 리뷰어 상태 문자열 포맷
   * @private
   * @param {Object} statusMap 상태 맵
   * @returns {string}
   */
  static #formatReviewersStatusString(statusMap) {
    return Object.entries(statusMap)
      .map(([user, state]) => `<@${user}> (${state})`)
      .join(', ');
  }

  /**
   * 팀별 PR 그룹화
   * @private
   * @param {Array} prs PR 목록
   * @returns {Object}
   */
  static #groupPullRequestsByTeam(prs) {
    return GITHUB_CONFIG.TEAM_SLUGS.reduce((acc, slug) => ({
      ...acc,
      [slug]: prs.filter((pr) => pr.teamSlug === slug),
    }), {});
  }

  /**
   * 예약된 알림 전송
   * @private
   * @param {Object} groupedPrs 팀별 그룹화된 PR 목록
   * @returns {Promise<void>}
   */
  async #sendScheduledNotifications(groupedPrs) {
    const tasks = Object.entries(groupedPrs).flatMap(([teamSlug, prs]) => {
      if (prs.length === 0) return [];
      const channelId = SLACK_CHANNELS[teamSlug] || SLACK_CHANNELS.gitAny;
      return prs.map((pr) => this.#sendSinglePRNotification(pr, channelId));
    });

    await Promise.all(tasks);
  }

  /**
   * 단일 PR 알림 전송
   * @private
   * @param {Object} pr PR 정보
   * @param {string} channelId 채널 ID
   * @returns {Promise<void>}
   */
  async #sendSinglePRNotification(pr, channelId) {
    const data = {
      prUrl: pr.html_url,
      prTitle: pr.title,
      body: pr.reviewersStatusString,
      targetGithubUsername: pr.user.login,
    };

    await this.slackMessageService.sendScheduledReviewMessage(data, channelId);
  }
}

module.exports = ReviewEventHandler;
