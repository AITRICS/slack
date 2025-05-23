const BaseEventHandler = require('./baseEventHandler');
const Logger = require('../utils/logger');

/**
 * Handles comment events
 */
class CommentEventHandler extends BaseEventHandler {
  async processEvent(payload) {
    const isPRPageComment = payload.comment.issue_url !== undefined;

    if (isPRPageComment) {
      await this.handlePRPageComment(payload);
    } else {
      await this.handleCodeComment(payload);
    }
  }

  async handleCodeComment(payload) {
    const { repoName, prNumber } = CommentEventHandler.extractCommentInfo(payload);
    const recipients = await this.determineCodeCommentRecipients(payload, repoName, prNumber);

    if (recipients.length === 0) {
      Logger.info('No recipients found for code comment notification');
      return;
    }

    await this.sendCodeCommentToRecipients(payload, recipients, repoName, prNumber);
  }

  async determineCodeCommentRecipients(payload, repoName, prNumber) {
    const commentAuthor = payload.comment.user.login;
    const commentPath = payload.comment.path;
    const commentLine = payload.comment.line || payload.comment.original_line;

    // Get all participants in this comment thread
    const threadParticipants = await this.gitHubApiHelper.fetchCommentThreadParticipants(
      repoName,
      prNumber,
      commentPath,
      commentLine,
    );

    // If no thread participants found, fall back to PR author
    if (threadParticipants.length === 0) {
      const prAuthor = payload.pull_request.user.login;
      if (prAuthor !== commentAuthor) {
        return [{ githubUsername: prAuthor }];
      }
      return []; // If comment author is also PR author and no other participants
    }

    // Exclude the current comment author from recipients
    const recipients = threadParticipants
      .filter((username) => username !== commentAuthor)
      .map((username) => ({ githubUsername: username }));

    // Add Slack IDs to recipients
    return Promise.all(
      recipients.map(async (recipient) => {
        const slackId = await this.slackUserService.getSlackUserPropertyByGithubUsername(
          recipient.githubUsername,
          'id',
        );
        return { ...recipient, slackId };
      }),
    );
  }

  async sendCodeCommentToRecipients(payload, recipients, repoName, prNumber) {
    const recipientsByChannel = await this.groupRecipientsByChannel(recipients);

    const baseNotificationData = {
      commentUrl: payload.comment.html_url,
      prUrl: payload.pull_request.html_url,
      commentAuthorGitName: payload.comment.user.login,
      commentBody: payload.comment.body,
      prTitle: payload.pull_request.title,
      commentContent: payload.comment.diff_hunk,
    };

    baseNotificationData.commentAuthorSlackRealName = await this.slackUserService
      .getSlackUserPropertyByGithubUsername(
        baseNotificationData.commentAuthorGitName,
        'realName',
      );

    await Promise.all(
      Object.entries(recipientsByChannel).map(async ([channelId, channelRecipients]) => {
        const mentionsString = channelRecipients
          .map((recipient) => `<@${recipient.slackId}>`)
          .join(', ');

        const notificationData = {
          ...baseNotificationData,
          mentionedSlackId: mentionsString, // Modified to handle multiple mentions
        };

        await this.slackMessageService.sendCodeCommentMessage(notificationData, channelId);
        Logger.info(`Sent code comment notification to channel ${channelId} for ${channelRecipients.length} recipients`);
      }),
    );
  }

  static extractCommentInfo(payload) {
    return {
      repoName: payload.repository.name,
      prNumber: payload.pull_request.number,
    };
  }

  async handlePRPageComment(payload) {
    const { repoName, prNumber } = CommentEventHandler.extractPRInfo(payload);
    const recipients = await this.determineRecipients(payload, repoName, prNumber);

    if (recipients.length === 0) {
      Logger.info('No recipients found for PR page comment notification');
      return;
    }

    await this.sendToRecipients(payload, recipients, repoName, prNumber);
  }

  async prepareCodeCommentData(payload) {
    const data = {
      commentUrl: payload.comment?.html_url,
      mentionedGitName: payload.pull_request?.user.login,
      prUrl: payload.pull_request?.html_url,
      commentAuthorGitName: payload.comment?.user.login,
      commentBody: payload.comment?.body,
      prTitle: payload.pull_request?.title,
      commentContent: payload.comment?.diff_hunk,
    };

    // Handle reply comments
    if (payload.comment.in_reply_to_id) {
      const previousAuthor = await this.gitHubApiHelper.fetchCommentAuthor(
        payload.repository.name,
        payload.comment.in_reply_to_id,
      );

      if (previousAuthor !== data.commentAuthorGitName) {
        data.mentionedGitName = previousAuthor;
      }
    }

    return data;
  }

  async enrichWithSlackData(notificationData) {
    notificationData.mentionedSlackId = await this.slackUserService.getSlackUserPropertyByGithubUsername(
      notificationData.mentionedGitName,
      'id',
    );
    notificationData.commentAuthorSlackRealName = await this.slackUserService.getSlackUserPropertyByGithubUsername(
      notificationData.commentAuthorGitName,
      'realName',
    );
  }

  static extractPRInfo(payload) {
    return {
      repoName: payload.repository.name,
      prNumber: payload.issue.number,
    };
  }

  async determineRecipients(payload, repoName, prNumber) {
    const commentAuthorGitName = payload.comment.user.login;
    const prDetails = await this.gitHubApiHelper.fetchPullRequestDetails(repoName, prNumber);
    const prAuthorGitName = prDetails.user.login;

    const reviewers = await this.fetchAllReviewers(repoName, prNumber);

    let recipients = [];

    if (commentAuthorGitName === prAuthorGitName) {
      // PR author commented - notify all reviewers except author
      recipients = reviewers.filter((reviewer) => reviewer.githubUsername !== commentAuthorGitName);
    } else {
      // Reviewer commented - notify other reviewers + PR author
      recipients = await this.getRecipientsForReviewerComment(
        reviewers,
        commentAuthorGitName,
        prAuthorGitName,
      );
    }

    return CommentEventHandler.deduplicateRecipients(recipients);
  }

  async fetchAllReviewers(repoName, prNumber) {
    const prDetails = await this.gitHubApiHelper.fetchPullRequestDetails(repoName, prNumber);
    const reviews = await this.gitHubApiHelper.fetchPullRequestReviews(repoName, prNumber);

    const requestedReviewers = prDetails.requested_reviewers || [];
    const reviewSubmitters = reviews.map((review) => review.user.login);

    const allReviewers = [...new Set([
      ...requestedReviewers.map((r) => r.login),
      ...reviewSubmitters,
    ])];

    return Promise.all(
      allReviewers.map(async (githubUsername) => {
        const slackId = await this.slackUserService.getSlackUserPropertyByGithubUsername(
          githubUsername,
          'id',
        );
        return { githubUsername, slackId };
      }),
    );
  }

  async getRecipientsForReviewerComment(reviewers, commentAuthor, prAuthor) {
    const filteredReviewers = reviewers.filter(
      (reviewer) => reviewer.githubUsername !== commentAuthor,
    );

    const prAuthorInReviewers = reviewers.some(
      (reviewer) => reviewer.githubUsername === prAuthor,
    );

    if (!prAuthorInReviewers) {
      const prAuthorSlackId = await this.slackUserService.getSlackUserPropertyByGithubUsername(
        prAuthor,
        'id',
      );
      return [
        { githubUsername: prAuthor, slackId: prAuthorSlackId },
        ...filteredReviewers,
      ];
    }

    return filteredReviewers;
  }

  static deduplicateRecipients(recipients) {
    const uniqueRecipients = [];
    const addedGithubUsernames = new Set();

    recipients.forEach((recipient) => {
      if (!addedGithubUsernames.has(recipient.githubUsername)) {
        addedGithubUsernames.add(recipient.githubUsername);
        uniqueRecipients.push(recipient);
      }
    });

    return uniqueRecipients;
  }

  async sendToRecipients(payload, recipients, repoName, prNumber) {
    const recipientsByChannel = await this.groupRecipientsByChannel(recipients);
    const prDetails = await this.gitHubApiHelper.fetchPullRequestDetails(repoName, prNumber);

    const baseNotificationData = {
      commentUrl: payload.comment.html_url,
      prUrl: `https://github.com/${payload.repository.full_name}/pull/${prNumber}`,
      commentAuthorGitName: payload.comment.user.login,
      commentBody: payload.comment.body,
      prTitle: prDetails.title,
    };

    baseNotificationData.commentAuthorSlackRealName = await this.slackUserService
      .getSlackUserPropertyByGithubUsername(
        baseNotificationData.commentAuthorGitName,
        'realName',
      );

    await Promise.all(
      Object.entries(recipientsByChannel).map(async ([channelId, channelRecipients]) => {
        const mentionsString = channelRecipients
          .map((recipient) => `<@${recipient.slackId}>`)
          .join(', ');

        const notificationData = {
          ...baseNotificationData,
          mentionsString,
        };

        await this.slackMessageService.sendPRPageCommentMessage(notificationData, channelId);
        Logger.info(`Sent PR page comment notification to channel ${channelId} for ${channelRecipients.length} recipients`);
      }),
    );
  }

  async groupRecipientsByChannel(recipients) {
    const recipientsByChannel = {};

    await Promise.all(
      recipients.map(async (recipient) => {
        const channelId = await this.slackChannelService.selectChannel(recipient.githubUsername);

        if (!recipientsByChannel[channelId]) {
          recipientsByChannel[channelId] = [];
        }

        recipientsByChannel[channelId].push(recipient);
      }),
    );

    return recipientsByChannel;
  }
}

module.exports = CommentEventHandler;
