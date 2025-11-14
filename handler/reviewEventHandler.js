const { REVIEW_STATES, GITHUB_CONFIG, SLACK_CHANNELS } = require('../constants');
const Logger = require('../utils/logger');
const BaseEventHandler = require('./baseEventHandler');

/**
 * 리뷰 이벤트 처리
 */
class ReviewEventHandler extends BaseEventHandler {
  /**
   * 승인 이벤트 처리
   * @param {ReviewPayload} payload - GitHub webhook payload
   * @returns {Promise<void>}
   * @throws {PayloadValidationError} 페이로드 검증 실패 시
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
   * 리뷰 요청 이벤트 처리 (개별 또는 팀)
   * @param {ReviewPayload} payload - GitHub webhook payload
   * @returns {Promise<void>}
   * @throws {PayloadValidationError} 페이로드 검증 실패 시
   */
  async handleReviewRequestEvent(payload) {
    BaseEventHandler.validatePayload(payload);
    await this.initialize();

    // 개별 리뷰어 요청
    if (payload.requested_reviewer) {
      await this.#handleIndividualReviewRequest(payload);
      return;
    }

    // 팀 리뷰어 요청
    if (payload.requested_team) {
      await this.#handleTeamReviewRequest(payload);
      return;
    }

    Logger.warn('리뷰 요청 이벤트에 requested_reviewer 또는 requested_team이 없습니다', {
      action: payload.action,
      prNumber: payload.pull_request?.number,
    });
  }

  /**
   * 개별 리뷰어 요청 처리
   * @private
   * @param {ReviewPayload} payload - GitHub webhook payload
   * @returns {Promise<void>}
   */
  async #handleIndividualReviewRequest(payload) {
    const notification = ReviewEventHandler.#buildReviewRequestNotificationData(payload);

    const enriched = await this.#enrichWithSlackData({
      targetGh: notification.reviewerGithubUsername,
      authorGh: notification.targetGithubUsername,
    });

    const channelId = await this.slackChannelService.selectChannel(notification.reviewerGithubUsername);

    const formattedNotification = {
      ...notification,
      ...enriched,
      targetSlackId: `<@${enriched.targetSlackId}>`,
    };

    await this.slackMessageService.sendReviewRequestMessage(formattedNotification, channelId);
    Logger.info(`리뷰 요청 알림 전송 완료: ${notification.reviewerGithubUsername}`);
  }

  /**
   * 팀 리뷰어 요청 처리
   * @private
   * @param {ReviewPayload} payload - GitHub webhook payload
   * @returns {Promise<void>}
   */
  async #handleTeamReviewRequest(payload) {
    const { requested_team: team, pull_request: pr } = payload;
    const teamSlug = team.slug;
    const prAuthor = pr.user.login;

    Logger.info(`팀 리뷰 요청 처리: ${teamSlug} (PR #${pr.number})`);

    try {
      // 팀 멤버 조회
      const teamMembers = await this.gitHubApiHelper.fetchTeamMembers(teamSlug);

      if (teamMembers.length === 0) {
        Logger.warn(`팀에 멤버가 없습니다: ${teamSlug}`);
        return;
      }

      // PR 작성자 제외
      const reviewerUsernames = teamMembers
        .map((member) => member.login)
        .filter((username) => username !== prAuthor);

      if (reviewerUsernames.length === 0) {
        Logger.info(`팀 리뷰 요청 대상 없음 (PR 작성자 제외 후): ${teamSlug}`);
        return;
      }

      Logger.info(`팀 멤버 ${reviewerUsernames.length}명에게 리뷰 요청 알림 전송: ${teamSlug}`);

      const notification = {
        prUrl: pr.html_url,
        prTitle: pr.title,
        targetGithubUsername: prAuthor,
      };

      await this.#sendReviewRequestToMultipleReviewers(notification, reviewerUsernames, prAuthor);

      Logger.info(`팀 리뷰 요청 알림 전송 완료: ${teamSlug}`);
    } catch (error) {
      Logger.error(`팀 리뷰 요청 처리 실패: ${teamSlug}`, error);
      throw error;
    }
  }

  /**
   * 여러 리뷰어에게 채널별로 그룹화하여 알림 전송
   * @private
   * @param {Object} notification - 알림 기본 정보
   * @param {string[]} reviewerUsernames - 리뷰어 GitHub 사용자명 목록
   * @param {string} prAuthor - PR 작성자 GitHub 사용자명
   * @returns {Promise<void>}
   */
  async #sendReviewRequestToMultipleReviewers(notification, reviewerUsernames, prAuthor) {
    // Slack ID 조회
    const reviewersWithSlackId = await this.slackUserService.addSlackIdsToRecipients(
      reviewerUsernames.map((username) => ({ githubUsername: username })),
    );

    // PR 작성자의 Slack 실명 조회
    const authorSlackName = await this.slackUserService.getSlackProperty(prAuthor, 'realName');

    // 채널별로 그룹화
    const reviewersByChannel = await this.#groupReviewersByChannel(reviewersWithSlackId);

    // 각 채널에 그룹 멘션으로 알림 전송
    await Promise.all(
      Object.entries(reviewersByChannel).map(async ([channelId, channelReviewers]) => {
        const mentions = channelReviewers.map((r) => `<@${r.slackId}>`).join(', ');

        const enrichedNotification = {
          ...notification,
          authorSlackName,
          targetSlackId: mentions, // 여러 멘션을 하나의 문자열로
        };

        await this.slackMessageService.sendReviewRequestMessage(enrichedNotification, channelId);
        Logger.info(`팀 리뷰 요청 알림 전송 (채널: ${channelId}, 리뷰어: ${channelReviewers.length}명)`);
      }),
    );
  }

  /**
   * 리뷰어를 채널별로 그룹화
   * @private
   * @param {UserMappingResult[]} reviewers - 리뷰어 목록
   * @returns {Promise<Object<string, UserMappingResult[]>>} 채널별 그룹화된 리뷰어
   */
  async #groupReviewersByChannel(reviewers) {
    const groups = {};

    await Promise.all(
      reviewers.map(async (reviewer) => {
        const channelId = await this.slackChannelService.selectChannel(reviewer.githubUsername);

        if (!groups[channelId]) {
          groups[channelId] = [];
        }
        groups[channelId].push(reviewer);
      }),
    );

    return groups;
  }

  /**
   * 예약된 리뷰 알림 처리 (크론 트리거)
   * @param {Object} payload - 저장소 정보를 포함한 페이로드
   * @param {GitHubRepository} payload.repository - 저장소 정보
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
   * @param {Object} params - 매개변수
   * @param {string} params.targetGh - GitHub 사용자명 (멘션 대상)
   * @param {string} params.authorGh - GitHub 사용자명 (이벤트 발생자)
   * @returns {Promise<EnrichedSlackData>} 보강된 Slack 데이터
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
   * @param {string[]} ghUsernames - GitHub 사용자명 목록
   * @returns {Promise<[Map<string,string>,Map<string,string>]>} [ID 맵, 실명 맵]
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
   * @static
   * @param {Map<string,string>} map - Slack 매핑
   * @param {string} ghUsername - GitHub 사용자명
   * @returns {string} Slack 값 또는 폴백값
   */
  static #getSlackMapValue(map, ghUsername) {
    return map.get(ghUsername) || ghUsername;
  }

  /**
   * 승인 알림 데이터 생성
   * @private
   * @static
   * @param {ReviewPayload} payload - 리뷰 페이로드
   * @returns {ApprovalNotificationData} 승인 알림 데이터
   */
  static #buildApprovalNotificationData(payload) {
    return {
      commentUrl: payload.review.html_url,
      commentBody: payload.review.body || '',
      prUrl: payload.pull_request.html_url,
      prTitle: payload.pull_request.title,
      targetGithubUsername: payload.pull_request.user.login,
      authorGithubUsername: payload.review.user.login,
    };
  }

  /**
   * 리뷰 요청 알림 데이터 생성
   * @private
   * @static
   * @param {ReviewPayload} payload - 리뷰 요청 페이로드
   * @returns {ReviewRequestNotificationData} 리뷰 요청 알림 데이터
   */
  static #buildReviewRequestNotificationData(payload) {
    return {
      prUrl: payload.pull_request.html_url,
      prTitle: payload.pull_request.title,
      targetGithubUsername: payload.pull_request.user.login,
      reviewerGithubUsername: payload.requested_reviewer?.login,
    };
  }

  /**
   * PR 목록에 리뷰 상태 정보 추가
   * @private
   * @param {GitHubPullRequest[]} pullRequests - PR 목록
   * @param {string} repoName - 저장소명
   * @returns {Promise<EnrichedPullRequest[]>} 보강된 PR 목록
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
   * @param {string} repoName - 저장소명
   * @param {number} prNumber - PR 번호
   * @returns {Promise<Object<string, string>>} 리뷰어별 상태 맵
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

    reviews.forEach((r) => {
      reviewersState[ReviewEventHandler.#getSlackMapValue(idMap, r.user.login)] = r.state || REVIEW_STATES.COMMENTED;
    });

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
   * @static
   * @param {Object<string, string>} statusMap - 상태 맵 (SlackID -> 상태)
   * @returns {string} 포맷된 상태 문자열
   */
  static #formatReviewersStatusString(statusMap) {
    return Object.entries(statusMap)
      .map(([user, state]) => `<@${user}> (${state})`)
      .join(', ');
  }

  /**
   * 팀별 PR 그룹화
   * @private
   * @static
   * @param {EnrichedPullRequest[]} prs - PR 목록
   * @returns {TeamGroupedPRs} 팀별 그룹화된 PR 목록
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
   * @param {TeamGroupedPRs} groupedPrs - 팀별 그룹화된 PR 목록
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
   * @param {EnrichedPullRequest} pr - PR 정보
   * @param {string} channelId - 채널 ID
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
