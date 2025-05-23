const SlackMessageFormatter = require('./slackMessageFormatter');
const Logger = require('../utils/logger');

/**
 * Service for sending Slack messages
 */
class SlackMessageService {
  /**
   * @param {import('@slack/web-api').WebClient} webClient
   */
  constructor(webClient) {
    this.webClient = webClient;
  }

  /**
   * Sends a message to Slack
   * @param {Object} message
   * @throws {Error}
   */
  async sendMessage(message) {
    try {
      await this.webClient.chat.postMessage(message);
    } catch (error) {
      Logger.error('Failed to send Slack message', error);
      throw new Error('Failed to send Slack message');
    }
  }

  /**
   * Sends a code comment notification
   * @param {Object} data
   * @param {string} channelId
   */
  async sendCodeCommentMessage(data, channelId) {
    const { text, attachment } = SlackMessageFormatter.formatCodeCommentMessage(data);
    const message = SlackMessageFormatter.createMessage(channelId, text, [attachment]);
    await this.sendMessage(message);
  }

  /**
   * Sends a PR page comment notification
   * @param {Object} data
   * @param {string} channelId
   */
  async sendPRPageCommentMessage(data, channelId) {
    const { text, attachment } = SlackMessageFormatter.formatPRPageCommentMessage(data);
    const message = SlackMessageFormatter.createMessage(channelId, text, [attachment]);
    await this.sendMessage(message);
  }

  /**
   * Sends an approval notification
   * @param {Object} data
   * @param {string} channelId
   */
  async sendApprovalMessage(data, channelId) {
    const { text, attachment } = SlackMessageFormatter.formatApprovalMessage(data);
    const message = SlackMessageFormatter.createMessage(channelId, text, [attachment]);
    await this.sendMessage(message);
  }

  /**
   * Sends a review request notification
   * @param {Object} data
   * @param {string} channelId
   */
  async sendReviewRequestMessage(data, channelId) {
    const { text, attachment } = SlackMessageFormatter.formatReviewRequestMessage(data);
    const message = SlackMessageFormatter.createMessage(channelId, text, [attachment]);
    await this.sendMessage(message);
  }

  /**
   * Sends a scheduled review notification
   * @param {Object} data
   * @param {string} channelId
   */
  async sendScheduledReviewMessage(data, channelId) {
    const { text, attachment } = SlackMessageFormatter.formatScheduledReviewMessage(data);
    const message = SlackMessageFormatter.createMessage(channelId, text, [attachment]);
    await this.sendMessage(message);
  }

  /**
   * Sends a deployment notification
   * @param {Object} data
   * @param {string} channelId
   */
  async sendDeploymentMessage(data, channelId) {
    const { text, attachment } = SlackMessageFormatter.formatDeploymentMessage(data);
    const message = SlackMessageFormatter.createMessage(channelId, text, [attachment]);
    await this.sendMessage(message);
  }

  /**
   * Sends a build notification
   * @param {Object} data
   * @param {string} channelId
   */
  async sendBuildMessage(data, channelId) {
    const { text, attachment } = SlackMessageFormatter.formatBuildMessage(data);
    const message = SlackMessageFormatter.createMessage(channelId, text, [attachment]);
    await this.sendMessage(message);
  }
}

module.exports = SlackMessageService;
