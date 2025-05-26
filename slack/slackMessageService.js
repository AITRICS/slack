const SlackMessageFormatter = require('./slackMessageFormatter');
const Logger = require('../utils/logger');
const { SlackAPIError } = require('../utils/errors');

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
   * @throws {SlackAPIError}
   */
  async sendMessage(message) {
    try {
      Logger.debug('Slack 메시지 전송 시작', { channel: message.channel });

      const result = await this.webClient.chat.postMessage(message);

      if (!result.ok) {
        throw new SlackAPIError(
          'Slack 메시지 전송 실패',
          {
            error: result.error,
            channel: message.channel,
            response: result,
          },
        );
      }

      Logger.debug('Slack 메시지 전송 완료', {
        channel: message.channel,
        messageId: result.message?.ts,
      });
    } catch (error) {
      Logger.error('Slack 메시지 전송 실패', error);

      if (error instanceof SlackAPIError) {
        throw error;
      }

      throw new SlackAPIError(
        'Slack 메시지 전송 중 오류 발생',
        {
          originalError: error.message,
          channel: message.channel,
        },
      );
    }
  }

  /**
   * Sends a code comment notification
   * @param {Object} data
   * @param {string} channelId
   * @throws {SlackAPIError}
   */
  async sendCodeCommentMessage(data, channelId) {
    try {
      const { text, attachment } = SlackMessageFormatter.formatCodeCommentMessage(data);
      const message = SlackMessageFormatter.createMessage(channelId, text, [attachment]);
      await this.sendMessage(message);
      Logger.info(`코드 코멘트 알림 전송 완료: ${channelId}`);
    } catch (error) {
      Logger.error('코드 코멘트 알림 전송 실패', error);
      throw new SlackAPIError(
        '코드 코멘트 알림 전송 실패',
        { channelId, data, originalError: error.message },
      );
    }
  }

  /**
   * Sends a PR page comment notification
   * @param {Object} data
   * @param {string} channelId
   * @throws {SlackAPIError}
   */
  async sendPRPageCommentMessage(data, channelId) {
    try {
      const { text, attachment } = SlackMessageFormatter.formatPRPageCommentMessage(data);
      const message = SlackMessageFormatter.createMessage(channelId, text, [attachment]);
      await this.sendMessage(message);
      Logger.info(`PR 페이지 코멘트 알림 전송 완료: ${channelId}`);
    } catch (error) {
      Logger.error('PR 페이지 코멘트 알림 전송 실패', error);
      throw new SlackAPIError(
        'PR 페이지 코멘트 알림 전송 실패',
        { channelId, data, originalError: error.message },
      );
    }
  }

  /**
   * Sends an approval notification
   * @param {Object} data
   * @param {string} channelId
   * @throws {SlackAPIError}
   */
  async sendApprovalMessage(data, channelId) {
    try {
      const { text, attachment } = SlackMessageFormatter.formatApprovalMessage(data);
      const message = SlackMessageFormatter.createMessage(channelId, text, [attachment]);
      await this.sendMessage(message);
      Logger.info(`승인 알림 전송 완료: ${channelId}`);
    } catch (error) {
      Logger.error('승인 알림 전송 실패', error);
      throw new SlackAPIError(
        '승인 알림 전송 실패',
        { channelId, data, originalError: error.message },
      );
    }
  }

  /**
   * Sends a review request notification
   * @param {Object} data
   * @param {string} channelId
   * @throws {SlackAPIError}
   */
  async sendReviewRequestMessage(data, channelId) {
    try {
      const { text, attachment } = SlackMessageFormatter.formatReviewRequestMessage(data);
      const message = SlackMessageFormatter.createMessage(channelId, text, [attachment]);
      await this.sendMessage(message);
      Logger.info(`리뷰 요청 알림 전송 완료: ${channelId}`);
    } catch (error) {
      Logger.error('리뷰 요청 알림 전송 실패', error);
      throw new SlackAPIError(
        '리뷰 요청 알림 전송 실패',
        { channelId, data, originalError: error.message },
      );
    }
  }

  /**
   * Sends a scheduled review notification
   * @param {Object} data
   * @param {string} channelId
   * @throws {SlackAPIError}
   */
  async sendScheduledReviewMessage(data, channelId) {
    try {
      const { text, attachment } = SlackMessageFormatter.formatScheduledReviewMessage(data);
      const message = SlackMessageFormatter.createMessage(channelId, text, [attachment]);
      await this.sendMessage(message);
      Logger.info(`예약된 리뷰 알림 전송 완료: ${channelId}`);
    } catch (error) {
      Logger.error('예약된 리뷰 알림 전송 실패', error);
      throw new SlackAPIError(
        '예약된 리뷰 알림 전송 실패',
        { channelId, data, originalError: error.message },
      );
    }
  }

  /**
   * Sends a deployment notification
   * @param {Object} data
   * @param {string} channelId
   * @throws {SlackAPIError}
   */
  async sendDeploymentMessage(data, channelId) {
    try {
      const { text, attachment } = SlackMessageFormatter.formatDeploymentMessage(data);
      const message = SlackMessageFormatter.createMessage(channelId, text, [attachment]);
      await this.sendMessage(message);
      Logger.info(`배포 알림 전송 완료: ${channelId}`);
    } catch (error) {
      Logger.error('배포 알림 전송 실패', error);
      throw new SlackAPIError(
        '배포 알림 전송 실패',
        { channelId, data, originalError: error.message },
      );
    }
  }

  /**
   * Sends a build notification
   * @param {Object} data
   * @param {string} channelId
   * @throws {SlackAPIError}
   */
  async sendBuildMessage(data, channelId) {
    try {
      const { text, attachment } = SlackMessageFormatter.formatBuildMessage(data);
      const message = SlackMessageFormatter.createMessage(channelId, text, [attachment]);
      await this.sendMessage(message);
      Logger.info(`빌드 알림 전송 완료: ${channelId}`);
    } catch (error) {
      Logger.error('빌드 알림 전송 실패', error);
      throw new SlackAPIError(
        '빌드 알림 전송 실패',
        { channelId, data, originalError: error.message },
      );
    }
  }
}

module.exports = SlackMessageService;
