const BaseEventHandler = require('./baseEventHandler');
const { REVIEW_STATES, GITHUB_CONFIG, SLACK_CHANNELS } = require('../constants');

/**
 * @typedef {Object} ReviewPayload
 * @property {Object} review
 * @property {string} review.html_url
 * @property {string} review.state
 * @property {string} review.body
 * @property {Object} review.user
 * @property {string} review.user.login
 * @property {Object} pull_request
 * @property {string} pull_request.html_url
 * @property {string} pull_request.title
 * @property {number} pull_request.number
 * @property {Object} pull_request.user
 * @property {string} pull_request.user.login
 * @property {Object} repository
 * @property {string} repository.name
 */

/**
 * @typedef {Object} ReviewRequestPayload
 * @property {Object} requested_reviewer
 * @property {string} requested_reviewer.login
 * @property {Object} pull_request
 * @property {string} pull_request.html_url
 * @property {string} pull_request.title
 * @property {Object} pull_request.user
 * @property {string} pull_request.user.login
 * @property {Object} repository
 * @property {string} repository.name
 */

/**
 * PR 리뷰 관련 이벤트 처리
 */
class ReviewEventHandler extends BaseEventHandler {
  /**
   * 승인 이벤트 처리
   * @param {ReviewPayload} payload
   */
  async handleApprovalEvent(payload) {
    const notificationData = this.buildApprovalNotificationData(payload);
    const channelId = await this.slackChannelService.selectChannel(notificationData.targetGithubUsername);

    await this.enrichNotificationWithSlackData(notificationData);
    await this.slackMessageService.sendApprovalMessage(notificationData, channelId);
  }

  /**
   * 리뷰 요청 이벤트 처리
   * @param {ReviewRequestPayload} payload
   */
  async handleReviewRequestEvent(payload) {
    const notificationData = this.buildReviewRequestNotificationData(payload);
    const channelId = await this.slackChannelService.selectChannel(notificationData.reviewerGithubUsername);

    await this.enrichReviewRequestWithSlackData(notificationData);
    await this.slackMessageService.sendReviewRequestMessage(notificationData, channelId);
  }

  /**
   * 예약된 리뷰 알림 처리
   * @param {Object} payload
   */
  async handleScheduledReview(payload) {
    const repoName = payload.repository.name;
    const openPullRequests = await this.gitHubApiHelper.fetchOpenPullRequests(repoName);
    const nonDraftPRs = openPullRequests.filter((pr) => !pr.draft);

    const enrichedPRs = await this.enrichPRsWithReviewStatus(nonDraftPRs, repoName);
    const teamGroupedPRs = this.groupPullRequestsByTeam(enrichedPRs);

    await this.sendScheduledNotifications(teamGroupedPRs);
  }

  /**
   * 승인 알림 데이터 생성
   * @param {ReviewPayload} payload
   * @returns {Object}
   */
  buildApprovalNotificationData(payload) {
    return {
      commentUrl: payload.review.html_url,
      targetGithubUsername: payload.pull_request.user.login,
      prUrl: payload.pull_request.html_url,
      authorGithubUsername: payload.review.user.login,
      commentBody: payload.review.body || '',
      prTitle: payload.pull_request.title,
    };
  }

  /**
   * 리뷰 요청 알림 데이터 생성
   * @param {ReviewRequestPayload} payload
   * @returns {Object}
   */
  buildReviewRequestNotificationData(payload) {
    return {
      targetGithubUsername: payload.pull_request.user.login,
      prUrl: payload.pull_request.html_url,
      reviewerGithubUsername: payload.requested_reviewer?.login,
      prTitle: payload.pull_request.title,
    };
  }

  /**
   * 승인 알림에 Slack 데이터 추가
   * @param {Object} notificationData
   */
  async enrichNotificationWithSlackData(notificationData) {
    const usernames = [notificationData.targetGithubUsername, notificationData.authorGithubUsername];

    const [slackIdMap, realNameMap] = await Promise.all([
      this.slackUserService.getSlackProperties(usernames, 'id'),
      this.slackUserService.getSlackProperties([notificationData.authorGithubUsername], 'realName'),
    ]);

    notificationData.targetSlackId = slackIdMap.get(notificationData.targetGithubUsername)
      || notificationData.targetGithubUsername;
    notificationData.authorSlackName = realNameMap.get(notificationData.authorGithubUsername)
      || notificationData.authorGithubUsername;
  }

  /**
   * 리뷰 요청 알림에 Slack 데이터 추가
   * @param {Object} notificationData
   */
  async enrichReviewRequestWithSlackData(notificationData) {
    const usernames = [notificationData.reviewerGithubUsername, notificationData.targetGithubUsername];

    const [slackIdMap, realNameMap] = await Promise.all([
      this.slackUserService.getSlackProperties(usernames, 'id'),
      this.slackUserService.getSlackProperties([notificationData.targetGithubUsername], 'realName'),
    ]);

    notificationData.targetSlackId = slackIdMap.get(notificationData.reviewerGithubUsername)
      || notificationData.reviewerGithubUsername;
    notificationData.authorSlackName = realNameMap.get(notificationData.targetGithubUsername)
      || notificationData.targetGithubUsername;
  }

  /**
   * PR들에 리뷰 상태 정보 추가
   * @param {Array} pullRequests
   * @param {string} repoName
   * @returns {Promise<Array>}
   */
  async enrichPRsWithReviewStatus(pullRequests, repoName) {
    return Promise.all(
      pullRequests.map(async (pr) => {
        const reviewersWithStatus = await this.getReviewersWithStatus(repoName, pr.number);
        const reviewersStatusString = this.formatReviewersStatusString(reviewersWithStatus);
        const teamSlug = await this.slackChannelService.findUserTeamSlug(pr.user.login);

        return {
          ...pr,
          reviewersStatusString,
          teamSlug,
        };
      }),
    );
  }

  /**
   * PR의 리뷰어별 상태 조회
   * @param {string} repoName
   * @param {number} prNumber
   * @returns {Promise<Object>} 리뷰어별 상태 맵
   */
  async getReviewersWithStatus(repoName, prNumber) {
    const [reviews, prDetails] = await Promise.all([
      this.gitHubApiHelper.fetchPullRequestReviews(repoName, prNumber),
      this.gitHubApiHelper.fetchPullRequestDetails(repoName, prNumber),
    ]);

    const submittedReviewers = reviews.map((review) => review.user.login);
    const requestedReviewers = (prDetails.requested_reviewers || []).map((reviewer) => reviewer.login);
    const allReviewerUsernames = [...new Set([...submittedReviewers, ...requestedReviewers])];

    // Slack ID 일괄 조회
    const slackIdMap = await this.slackUserService.getSlackProperties(allReviewerUsernames, 'id');

    const reviewersStatus = {};

    // 제출된 리뷰 처리
    reviews.forEach((review) => {
      const slackId = slackIdMap.get(review.user.login) || review.user.login;
      reviewersStatus[slackId] = review.state || REVIEW_STATES.COMMENTED;
    });

    // 요청된 리뷰어 처리 (아직 리뷰하지 않은 경우)
    requestedReviewers.forEach((githubUsername) => {
      const slackId = slackIdMap.get(githubUsername) || githubUsername;
      if (!reviewersStatus[slackId]) {
        reviewersStatus[slackId] = REVIEW_STATES.AWAITING;
      }
    });

    return reviewersStatus;
  }

  /**
   * 리뷰어 상태를 문자열로 포맷
   * @param {Object} reviewersWithStatus
   * @returns {string}
   */
  formatReviewersStatusString(reviewersWithStatus) {
    return Object.entries(reviewersWithStatus)
      .map(([reviewer, status]) => `<@${reviewer}> (${status})`)
      .join(', ');
  }

  /**
   * PR을 팀별로 그룹화
   * @param {Array} pullRequestDetails
   * @returns {Object}
   */
  groupPullRequestsByTeam(pullRequestDetails) {
    return GITHUB_CONFIG.TEAM_SLUGS.reduce((groupedPRs, teamSlug) => {
      const teamPRs = pullRequestDetails.filter((pr) => pr.teamSlug === teamSlug);
      return {
        ...groupedPRs,
        [teamSlug]: teamPRs,
      };
    }, {});
  }

  /**
   * 팀별 예약 알림 전송
   * @param {Object} teamGroupedPRs
   */
  async sendScheduledNotifications(teamGroupedPRs) {
    const notificationPromises = Object.entries(teamGroupedPRs).flatMap(([teamSlug, prs]) => {
      if (prs.length === 0) return [];

      const channelId = SLACK_CHANNELS[teamSlug] || SLACK_CHANNELS.gitAny;
      return prs.map((pr) => this.sendSinglePRNotification(pr, channelId));
    });

    await Promise.all(notificationPromises);
  }

  /**
   * 단일 PR 알림 전송
   * @param {Object} pullRequest
   * @param {string} channelId
   */
  async sendSinglePRNotification(pullRequest, channelId) {
    const notificationData = {
      targetGithubUsername: pullRequest.user.login,
      prUrl: pullRequest.html_url,
      body: pullRequest.reviewersStatusString,
      prTitle: pullRequest.title,
    };

    await this.slackMessageService.sendScheduledReviewMessage(notificationData, channelId);
  }
}

module.exports = ReviewEventHandler;
