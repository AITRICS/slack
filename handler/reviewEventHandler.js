const BaseEventHandler = require('./baseEventHandler');
const { REVIEW_STATES, GITHUB_CONFIG, SLACK_CHANNELS } = require('../constants');

/**
 * Handles review-related events with optimized Slack API usage
 */
class ReviewEventHandler extends BaseEventHandler {
  /**
   * Handles approval events
   */
  async handleApprove(payload) {
    const notificationData = await this.prepareApprovalData(payload);
    const channelId = await this.slackChannelService.selectChannel(notificationData.mentionedGitName);

    await this.enrichWithSlackData(notificationData);
    await this.slackMessageService.sendApprovalMessage(notificationData, channelId);
  }

  /**
   * Handles review request events
   */
  async handleReviewRequested(payload) {
    const notificationData = await this.prepareReviewRequestData(payload);
    const channelId = await this.slackChannelService.selectChannel(notificationData.reviewerGitName);

    await this.enrichReviewRequestData(notificationData);
    await this.slackMessageService.sendReviewRequestMessage(notificationData, channelId);
  }

  /**
   * Handles scheduled review notifications
   */
  async handleSchedule(payload) {
    const repoName = payload.repository.name;
    const allPRs = await this.gitHubApiHelper.fetchOpenPullRequests(repoName);
    const nonDraftPRs = allPRs.filter((pr) => !pr.draft);

    const pullRequestDetails = await this.enrichPRsWithReviewData(nonDraftPRs, repoName);
    const teamPRs = ReviewEventHandler.groupPullRequestsByTeam(pullRequestDetails);

    await this.sendScheduledNotifications(teamPRs);
  }

  async prepareApprovalData(payload) {
    return {
      commentUrl: payload.review?.html_url,
      mentionedGitName: payload.pull_request?.user.login,
      prUrl: payload.pull_request?.html_url,
      commentAuthorGitName: payload.review?.user.login,
      commentBody: payload.review?.body || '',
      prTitle: payload.pull_request?.title,
    };
  }

  async prepareReviewRequestData(payload) {
    return {
      mentionedGitName: payload.pull_request?.user.login,
      prUrl: payload.pull_request?.html_url,
      reviewerGitName: payload.requested_reviewer?.login ?? payload.review?.user.login,
      prTitle: payload.pull_request?.title,
    };
  }

  async enrichWithSlackData(notificationData) {
    // Use batch processing for multiple Slack lookups
    const usernames = [notificationData.mentionedGitName, notificationData.commentAuthorGitName];
    const slackIdMap = await this.slackUserService.getSlackUserPropertiesBatch(usernames, 'id');
    const realNameMap = await this.slackUserService.getSlackUserPropertiesBatch([notificationData.commentAuthorGitName], 'realName');

    notificationData.mentionedSlackId = slackIdMap.get(notificationData.mentionedGitName) || notificationData.mentionedGitName;
    notificationData.commentAuthorSlackRealName = realNameMap.get(notificationData.commentAuthorGitName) || notificationData.commentAuthorGitName;
  }

  async enrichReviewRequestData(notificationData) {
    // Use batch processing for multiple Slack lookups
    const usernames = [notificationData.reviewerGitName, notificationData.mentionedGitName];
    const slackIdMap = await this.slackUserService.getSlackUserPropertiesBatch(usernames, 'id');
    const realNameMap = await this.slackUserService.getSlackUserPropertiesBatch([notificationData.mentionedGitName], 'realName');

    notificationData.mentionedSlackId = slackIdMap.get(notificationData.reviewerGitName) || notificationData.reviewerGitName;
    notificationData.commentAuthorSlackRealName = realNameMap.get(notificationData.mentionedGitName) || notificationData.mentionedGitName;
  }

  async enrichPRsWithReviewData(prs, repoName) {
    return Promise.all(
      prs.map(async (pr) => {
        const reviewersAndStatus = await this.getPRReviewersWithStatus(repoName, pr.number);
        const reviewersString = ReviewEventHandler.formatReviewerStatusString(reviewersAndStatus);
        const teamSlug = await this.slackChannelService.findUserTeamSlug(pr.user.login);

        return { ...pr, reviewersString, teamSlug };
      }),
    );
  }

  async getPRReviewersWithStatus(repoName, prNumber) {
    const [reviewsData, prDetailsData] = await Promise.all([
      this.gitHubApiHelper.fetchPullRequestReviews(repoName, prNumber),
      this.gitHubApiHelper.fetchPullRequestDetails(repoName, prNumber),
    ]);

    // Collect all GitHub usernames
    const submittedReviewers = reviewsData.map((review) => review.user.login);
    const requestedReviewers = (prDetailsData.requested_reviewers || []).map((reviewer) => reviewer.login);
    const allUsernames = [...new Set([...submittedReviewers, ...requestedReviewers])];

    // Batch process Slack IDs
    const slackIdMap = await this.slackUserService.getSlackUserPropertiesBatch(allUsernames, 'id');

    // Map reviewers to their status and Slack IDs
    const reviewersStatus = {};

    // Process submitted reviews
    reviewsData.forEach((review) => {
      const githubUsername = review.user.login;
      const slackId = slackIdMap.get(githubUsername) || githubUsername;
      reviewersStatus[slackId] = review.state || REVIEW_STATES.COMMENTED;
    });

    // Process requested reviewers
    requestedReviewers.forEach((githubUsername) => {
      const slackId = slackIdMap.get(githubUsername) || githubUsername;
      // Only add if not already present (submitted review takes precedence)
      if (!reviewersStatus[slackId]) {
        reviewersStatus[slackId] = REVIEW_STATES.AWAITING;
      }
    });

    return reviewersStatus;
  }

  static formatReviewerStatusString(reviewersAndStatus) {
    return Object.entries(reviewersAndStatus)
      .map(([reviewer, status]) => `<@${reviewer}> (${status})`)
      .join(', ');
  }

  static groupPullRequestsByTeam(pullRequestDetails) {
    return GITHUB_CONFIG.TEAM_SLUGS.reduce((groupedPRs, currentTeamSlug) => {
      const prsForCurrentTeam = pullRequestDetails.filter(
        (prDetail) => prDetail.teamSlug === currentTeamSlug,
      );
      return {
        ...groupedPRs,
        [currentTeamSlug]: prsForCurrentTeam,
      };
    }, {});
  }

  async sendScheduledNotifications(teamPRs) {
    const notificationPromises = Object.entries(teamPRs).flatMap(([teamSlug, prs]) => {
      if (prs.length === 0) return [];

      const channelId = SLACK_CHANNELS[teamSlug] || SLACK_CHANNELS.gitAny;
      return prs.map((pr) => this.sendPRNotification(pr, channelId));
    });

    await Promise.all(notificationPromises);
  }

  async sendPRNotification(pr, channelId) {
    const notificationData = {
      mentionedGitName: pr.author,
      prUrl: pr.html_url,
      body: pr.reviewersString,
      prTitle: pr.title,
    };

    await this.slackMessageService.sendScheduledReviewMessage(notificationData, channelId);
  }
}

module.exports = ReviewEventHandler;
