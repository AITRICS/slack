class SlackMessages {
  /**
   * Constructs the SlackMessages class.
   * @param {WebClient} web - The Slack WebClient instance.
   */
  constructor(web) {
    this.web = web;
  }

  /**
   * Creates a Slack message object.
   * @param {string} channelId - The ID of the Slack channel to send the message to.
   * @param {string} text - The main text of the message.
   * @param {object[]} attachments - An array of attachment objects for the message.
   * @returns {object} The formatted Slack message object.
   */
  static #createMessage(channelId, text, attachments) {
    return {
      channel: channelId,
      text,
      attachments,
      mrkdwn: true,
    };
  }

  static #createField(title, value, isShort) {
    return { title, value, short: isShort };
  }

  /**
   * Sends a formatted Slack message.
   * @param {object} message - The Slack message object to send.
   * @throws Will throw an error if the Slack API request fails.
   */
  async #sendSlackMessage(message) {
    try {
      await this.web.chat.postMessage(message);
    } catch (error) {
      console.error('Error sending Slack message:', error);
      throw error;
    }
  }

  /**
   * Sends a Slack message related to a GitHub event.
   * This method is used for various GitHub events such as comments, approvals, and review requests.
   * Depending on the event type, the message content and format vary.
   * @param {object} commentData - Data about the GitHub event.
   * @param {string} channelId - The ID of the Slack channel to send the message to.
   */
  async sendSlackMessageToComment(commentData, channelId) {
    const contentText = commentData.commentContent
      ? `\`\`\`${commentData.commentContent}\`\`\`\n`
      : '';

    const attachments = [{
      color: 'good',
      text: `${contentText}\n*코맨트 내용 :*\n${commentData.commentBody}\n\n<${commentData.commentUrl}|코멘트 보러가기>\n\n`,
    }];

    const message = SlackMessages.#createMessage(
      channelId,
      `*<${commentData.prUrl}|${commentData.prTitle}>*\n:pencil: *${commentData.commentAuthorSlackRealName}* 님이 코멘트를 남겼어요!! <@${commentData.mentionedSlackId}>:\n`,
      attachments,
    );

    await this.#sendSlackMessage(message);
  }

  async sendSlackMessageToApprove(commentData, channelId) {
    const attachments = [{
      color: 'good',
      text: `${commentData.commentBody}\n\n<${commentData.commentUrl}|코멘트 보러가기>.`,
    }];

    const message = SlackMessages.#createMessage(
      channelId,
      `*<${commentData.prUrl}|${commentData.prTitle}>*\n:white_check_mark: *${commentData.commentAuthorSlackRealName}* 님이 Approve를 했습니다!! <@${commentData.mentionedSlackId}>:\n`,
      attachments,
    );

    await this.#sendSlackMessage(message);
  }

  async sendSlackMessageToReviewRequested(commentData, channelId) {
    const attachments = [{
      color: 'good',
      text: `\n<${commentData.prUrl}|PR 보러가기>.`,
    }];

    const message = SlackMessages.#createMessage(
      channelId,
      `*<${commentData.prUrl}|${commentData.prTitle}>*\n:eyes: *${commentData.commentAuthorSlackRealName}* 님이 Review를 요청했습니다!! <@${commentData.mentionedSlackId}>:\n`,
      attachments,
    );

    await this.#sendSlackMessage(message);
  }

  async sendSlackMessageToSchedule(commentData, channelId) {
    const attachments = [{
      color: 'good',
      text: `\n<${commentData.prUrl}|PR 보러가기>.`,
    }];

    const message = SlackMessages.#createMessage(
      channelId,
      `*<${commentData.prUrl}|${commentData.prTitle}>* 에서 리뷰를 기다리고 있습니다. ${commentData.body}\n`,
      attachments,
    );

    await this.#sendSlackMessage(message);
  }

  async sendSlackMessageToDeploy(notificationData, channelId) {
    const attachmentFields = [
      SlackMessages.#createField(`${notificationData.slackStatusEmoji}Succeeded GitHub Actions`, '', false),
      SlackMessages.#createField('Repository', `<${notificationData.repoUrl}|${notificationData.repoName}>`, true),
      SlackMessages.#createField('Deploy Server', `<https://${notificationData.ec2Name}.aitrics-vc.com|${notificationData.ec2Name}>`, true),
      SlackMessages.#createField('Author', `<@${notificationData.triggerUser}>`, true),
      SlackMessages.#createField('Commit', `<${notificationData.commitUrl}|${notificationData.sha.slice(0, 7)}>`, true),
      SlackMessages.#createField('Image Tag', notificationData.imageTag, true),
      SlackMessages.#createField('Time', notificationData.totalRunTime, true),
      SlackMessages.#createField('Workflow', `<${notificationData.actionUrl}|${notificationData.workflowName}>`, true),
      SlackMessages.#createField('Ref', notificationData.ref, true),
    ];

    const attachments = [{
      color: notificationData.slackStatus,
      fields: attachmentFields,
    }];

    const message = SlackMessages.#createMessage(
      channelId,
      '',
      attachments,
    );
    await this.#sendSlackMessage(message);
  }
}

module.exports = SlackMessages;
