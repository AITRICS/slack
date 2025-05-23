const { SLACK_CONFIG } = require('../constants');

class SlackMessages {
  /**
   * Constructs the SlackMessages class.
   * @param {import('@slack/web-api').WebClient} webClient - The Slack WebClient instance.
   */
  constructor(webClient) {
    this.webClient = webClient;
  }

  /**
   * Creates a Slack message object.
   * @param {string} channelId - The ID of the Slack channel.
   * @param {string} text - The main text of the message.
   * @param {Array} attachments - An array of attachment objects.
   * @returns {Object} The formatted Slack message object.
   */
  static createMessage(channelId, text, attachments = []) {
    return {
      channel: channelId,
      text,
      attachments,
      mrkdwn: true,
    };
  }

  /**
   * Creates a field object for Slack message attachments.
   * @param {string} title - The field title.
   * @param {string} value - The field value.
   * @param {boolean} isShort - Whether the field should be displayed as short.
   * @returns {Object} The field object.
   */
  static createField(title, value, isShort = false) {
    return { title, value, short: isShort };
  }

  /**
   * Creates an attachment object for Slack messages.
   * @param {string} color - The color of the attachment.
   * @param {string} text - The text content.
   * @param {Array} fields - Array of field objects.
   * @returns {Object} The attachment object.
   */
  static createAttachment(color, text = '', fields = []) {
    return {
      color,
      text,
      fields,
    };
  }

  /**
   * Sends a formatted Slack message.
   * @param {Object} message - The Slack message object to send.
   * @throws Will throw an error if the Slack API request fails.
   */
  async sendMessage(message) {
    try {
      await this.webClient.chat.postMessage(message);
    } catch (error) {
      console.error('Error sending Slack message:', error);
      throw error;
    }
  }

  /**
   * Sends a Slack message for code review comments.
   * @param {Object} notificationData - Data about the comment event.
   * @param {string} channelId - The ID of the Slack channel.
   */
  async sendCodeCommentMessage(notificationData, channelId) {
    const {
      commentContent,
      commentBody,
      commentUrl,
      prUrl,
      prTitle,
      commentAuthorSlackRealName,
      mentionedSlackId,
    } = notificationData;

    const contentText = commentContent ? `\`\`\`${commentContent}\`\`\`\n` : '';
    const attachmentText = `${contentText}\n*코멘트 내용:*\n${commentBody}\n\n<${commentUrl}|코멘트 보러가기>\n\n`;

    const attachment = SlackMessages.createAttachment(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS, attachmentText);
    const text = `*<${prUrl}|${prTitle}>*\n${SLACK_CONFIG.ICONS.COMMENT} *${commentAuthorSlackRealName}* 님이 코멘트를 남겼어요!! <@${mentionedSlackId}>:\n`;

    const message = SlackMessages.createMessage(channelId, text, [attachment]);
    await this.sendMessage(message);
  }

  /**
   * Sends a Slack message for PR page comments with multiple mentions.
   * @param {Object} notificationData - Data about the PR page comment event.
   * @param {string} channelId - The ID of the Slack channel.
   */
  async sendPRPageCommentMessage(notificationData, channelId) {
    const {
      commentUrl,
      prUrl,
      commentAuthorSlackRealName,
      commentBody,
      prTitle,
      mentionsString,
    } = notificationData;

    const attachmentText = `*코멘트 내용:*\n${commentBody}\n\n<${commentUrl}|코멘트 보러가기>`;
    const attachment = SlackMessages.createAttachment(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS, attachmentText);
    const text = `*<${prUrl}|${prTitle}>*\n${SLACK_CONFIG.ICONS.PR_COMMENT} *${commentAuthorSlackRealName}* 님이 코멘트를 남겼어요!! ${mentionsString}`;

    const message = SlackMessages.createMessage(channelId, text, [attachment]);
    await this.sendMessage(message);
  }

  /**
   * Sends a Slack message for PR approvals.
   * @param {Object} notificationData - Data about the approval event.
   * @param {string} channelId - The ID of the Slack channel.
   */
  async sendApprovalMessage(notificationData, channelId) {
    const {
      commentBody,
      commentUrl,
      prUrl,
      prTitle,
      commentAuthorSlackRealName,
      mentionedSlackId,
    } = notificationData;

    const attachmentText = `${commentBody}\n\n<${commentUrl}|코멘트 보러가기>.`;
    const attachment = SlackMessages.createAttachment(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS, attachmentText);
    const text = `*<${prUrl}|${prTitle}>*\n${SLACK_CONFIG.ICONS.APPROVE} *${commentAuthorSlackRealName}* 님이 Approve를 했습니다!! <@${mentionedSlackId}>:\n`;

    const message = SlackMessages.createMessage(channelId, text, [attachment]);
    await this.sendMessage(message);
  }

  /**
   * Sends a Slack message for review requests.
   * @param {Object} notificationData - Data about the review request event.
   * @param {string} channelId - The ID of the Slack channel.
   */
  async sendReviewRequestMessage(notificationData, channelId) {
    const {
      prUrl,
      prTitle,
      commentAuthorSlackRealName,
      mentionedSlackId,
    } = notificationData;

    const attachmentText = `\n<${prUrl}|PR 보러가기>.`;
    const attachment = SlackMessages.createAttachment(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS, attachmentText);
    const text = `*<${prUrl}|${prTitle}>*\n${SLACK_CONFIG.ICONS.REVIEW_REQUEST} *${commentAuthorSlackRealName}* 님이 Review를 요청했습니다!! <@${mentionedSlackId}>:\n`;

    const message = SlackMessages.createMessage(channelId, text, [attachment]);
    await this.sendMessage(message);
  }

  /**
   * Sends a Slack message for scheduled PR reviews.
   * @param {Object} notificationData - Data about the scheduled review.
   * @param {string} channelId - The ID of the Slack channel.
   */
  async sendScheduledReviewMessage(notificationData, channelId) {
    const { prUrl, prTitle, body } = notificationData;

    const attachmentText = `\n<${prUrl}|PR 보러가기>.`;
    const attachment = SlackMessages.createAttachment(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS, attachmentText);
    const text = `*<${prUrl}|${prTitle}>* 에서 리뷰를 기다리고 있습니다. ${body}\n`;

    const message = SlackMessages.createMessage(channelId, text, [attachment]);
    await this.sendMessage(message);
  }

  /**
   * Sends a Slack message for deployment notifications.
   * @param {Object} notificationData - Data about the deployment event.
   * @param {string} channelId - The ID of the Slack channel.
   */
  async sendDeploymentMessage(notificationData, channelId) {
    const {
      slackDeployResult,
      slackStatus,
      repoUrl,
      repoName,
      ec2Name,
      triggerUser,
      commitUrl,
      sha,
      imageTag,
      totalRunTime,
      actionUrl,
      workflowName,
      ref,
    } = notificationData;

    const fields = [
      SlackMessages.createField('Deploy Info', '', false),
      SlackMessages.createField('Repository', `<${repoUrl}|${repoName}>`, true),
      SlackMessages.createField('Deploy Server', `https://${ec2Name}`, true),
      SlackMessages.createField('Author', `<@${triggerUser}>`, true),
      SlackMessages.createField('Commit', `<${commitUrl}|${sha.slice(0, 7)}>`, true),
      SlackMessages.createField('Image Tag', imageTag, true),
      SlackMessages.createField('Run Time', totalRunTime, true),
      SlackMessages.createField('Workflow', `<${actionUrl}|${workflowName}>`, true),
      SlackMessages.createField('Ref', ref, true),
    ];

    const attachment = SlackMessages.createAttachment(slackStatus, '', fields);
    const text = `${slackDeployResult} *GitHub Actions Deploy Notification*`;

    const message = SlackMessages.createMessage(channelId, text, [attachment]);
    await this.sendMessage(message);
  }

  /**
   * Sends a Slack message for build notifications.
   * @param {Object} notificationData - Data about the build event.
   * @param {string} channelId - The ID of the Slack channel.
   */
  async sendBuildMessage(notificationData, channelId) {
    const {
      slackBuildResult,
      slackStatus,
      repoUrl,
      repoName,
      branchName,
      triggerUser,
      commitUrl,
      sha,
      imageTag,
      totalRunTime,
      actionUrl,
      workflowName,
      jobNames,
    } = notificationData;

    const fields = [SlackMessages.createField('Build Info', '', false)];

    // Add failed jobs if build failed
    if (slackStatus === SLACK_CONFIG.MESSAGE_COLORS.DANGER && jobNames && jobNames.length > 0) {
      const formattedJobNames = jobNames.map((job) => `\`${job}\``).join('\n');
      fields.push(SlackMessages.createField('Failed Jobs', formattedJobNames, false));
    }

    fields.push(
      SlackMessages.createField('Repository', `<${repoUrl}|${repoName}>`, true),
      SlackMessages.createField('Branch', branchName || 'N/A', true),
      SlackMessages.createField('Author', `<@${triggerUser}>`, true),
      SlackMessages.createField('Commit', `<${commitUrl}|${sha.slice(0, 7)}>`, true),
    );

    if (imageTag) {
      fields.push(SlackMessages.createField('Image Tag', imageTag, true));
    }

    fields.push(
      SlackMessages.createField('Run Time', totalRunTime, true),
      SlackMessages.createField('Workflow', `<${actionUrl}|${workflowName}>`, true),
    );

    const attachment = SlackMessages.createAttachment(slackStatus, '', fields);
    const text = `${slackBuildResult} *GitHub Actions Build Notification*`;

    const message = SlackMessages.createMessage(channelId, text, [attachment]);
    await this.sendMessage(message);
  }
}

module.exports = SlackMessages;
