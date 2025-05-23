const { SLACK_CONFIG } = require('../constants');

/**
 * Formats messages for Slack
 */
class SlackMessageFormatter {
  /**
   * Creates a Slack message object
   * @param {string} channelId
   * @param {string} text
   * @param {Array} attachments
   * @returns {Object}
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
   * Creates a field object for Slack message attachments
   * @param {string} title
   * @param {string} value
   * @param {boolean} isShort
   * @returns {Object}
   */
  static createField(title, value, isShort = false) {
    return { title, value, short: isShort };
  }

  /**
   * Creates an attachment object for Slack messages
   * @param {string} color
   * @param {string} text
   * @param {Array} fields
   * @returns {Object}
   */
  static createAttachment(color, text = '', fields = []) {
    return {
      color,
      text,
      fields,
    };
  }

  /**
   * Formats code comment notification data
   * @param {Object} data
   * @returns {Object}
   */
  static formatCodeCommentMessage(data) {
    const {
      commentContent,
      commentBody,
      commentUrl,
      prUrl,
      prTitle,
      commentAuthorSlackRealName,
      mentionedSlackId,
    } = data;

    const contentText = commentContent ? `\`\`\`${commentContent}\`\`\`\n` : '';
    const attachmentText = `${contentText}\n*코멘트 내용:*\n${commentBody}\n\n<${commentUrl}|코멘트 보러가기>\n\n`;

    const attachment = this.createAttachment(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS, attachmentText);
    const text = `*<${prUrl}|${prTitle}>*\n${SLACK_CONFIG.ICONS.COMMENT} *${commentAuthorSlackRealName}* 님이 코멘트를 남겼어요!! <@${mentionedSlackId}>:\n`;

    return { text, attachment };
  }

  /**
   * Formats PR page comment notification data
   * @param {Object} data
   * @returns {Object}
   */
  static formatPRPageCommentMessage(data) {
    const {
      commentUrl,
      prUrl,
      commentAuthorSlackRealName,
      commentBody,
      prTitle,
      mentionsString,
    } = data;

    const attachmentText = `*코멘트 내용:*\n${commentBody}\n\n<${commentUrl}|코멘트 보러가기>`;
    const attachment = this.createAttachment(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS, attachmentText);
    const text = `*<${prUrl}|${prTitle}>*\n${SLACK_CONFIG.ICONS.PR_COMMENT} *${commentAuthorSlackRealName}* 님이 코멘트를 남겼어요!! ${mentionsString}`;

    return { text, attachment };
  }

  /**
   * Formats approval notification data
   * @param {Object} data
   * @returns {Object}
   */
  static formatApprovalMessage(data) {
    const {
      commentBody,
      commentUrl,
      prUrl,
      prTitle,
      commentAuthorSlackRealName,
      mentionedSlackId,
    } = data;

    const attachmentText = `${commentBody}\n\n<${commentUrl}|코멘트 보러가기>.`;
    const attachment = this.createAttachment(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS, attachmentText);
    const text = `*<${prUrl}|${prTitle}>*\n${SLACK_CONFIG.ICONS.APPROVE} *${commentAuthorSlackRealName}* 님이 Approve를 했습니다!! <@${mentionedSlackId}>:\n`;

    return { text, attachment };
  }

  /**
   * Formats review request notification data
   * @param {Object} data
   * @returns {Object}
   */
  static formatReviewRequestMessage(data) {
    const {
      prUrl,
      prTitle,
      commentAuthorSlackRealName,
      mentionedSlackId,
    } = data;

    const attachmentText = `\n<${prUrl}|PR 보러가기>.`;
    const attachment = this.createAttachment(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS, attachmentText);
    const text = `*<${prUrl}|${prTitle}>*\n${SLACK_CONFIG.ICONS.REVIEW_REQUEST} *${commentAuthorSlackRealName}* 님이 Review를 요청했습니다!! <@${mentionedSlackId}>:\n`;

    return { text, attachment };
  }

  /**
   * Formats scheduled review notification data
   * @param {Object} data
   * @returns {Object}
   */
  static formatScheduledReviewMessage(data) {
    const { prUrl, prTitle, body } = data;

    const attachmentText = `\n<${prUrl}|PR 보러가기>.`;
    const attachment = this.createAttachment(SLACK_CONFIG.MESSAGE_COLORS.SUCCESS, attachmentText);
    const text = `*<${prUrl}|${prTitle}>* 에서 리뷰를 기다리고 있습니다. ${body}\n`;

    return { text, attachment };
  }

  /**
   * Formats deployment notification data
   * @param {Object} data
   * @returns {Object}
   */
  static formatDeploymentMessage(data) {
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
    } = data;

    const fields = [
      this.createField('Deploy Info', '', false),
      this.createField('Repository', `<${repoUrl}|${repoName}>`, true),
      this.createField('Deploy Server', `https://${ec2Name}`, true),
      this.createField('Author', `<@${triggerUser}>`, true),
      this.createField('Commit', `<${commitUrl}|${sha.slice(0, 7)}>`, true),
      this.createField('Image Tag', imageTag, true),
      this.createField('Run Time', totalRunTime, true),
      this.createField('Workflow', `<${actionUrl}|${workflowName}>`, true),
      this.createField('Ref', ref, true),
    ];

    const attachment = this.createAttachment(slackStatus, '', fields);
    const text = `${slackDeployResult} *GitHub Actions Deploy Notification*`;

    return { text, attachment };
  }

  /**
   * Formats build notification data
   * @param {Object} data
   * @returns {Object}
   */
  static formatBuildMessage(data) {
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
    } = data;

    const fields = [this.createField('Build Info', '', false)];

    // Add failed jobs if build failed
    if (slackStatus === SLACK_CONFIG.MESSAGE_COLORS.DANGER && jobNames && jobNames.length > 0) {
      const formattedJobNames = jobNames.map((job) => `\`${job}\``).join('\n');
      fields.push(this.createField('Failed Jobs', formattedJobNames, false));
    }

    fields.push(
      this.createField('Repository', `<${repoUrl}|${repoName}>`, true),
      this.createField('Branch', branchName || 'N/A', true),
      this.createField('Author', `<@${triggerUser}>`, true),
      this.createField('Commit', `<${commitUrl}|${sha.slice(0, 7)}>`, true),
    );

    if (imageTag) {
      fields.push(this.createField('Image Tag', imageTag, true));
    }

    fields.push(
      this.createField('Run Time', totalRunTime, true),
      this.createField('Workflow', `<${actionUrl}|${workflowName}>`, true),
    );

    const attachment = this.createAttachment(slackStatus, '', fields);
    const text = `${slackBuildResult} *GitHub Actions Build Notification*`;

    return { text, attachment };
  }
}

module.exports = SlackMessageFormatter;
