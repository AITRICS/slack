class SlackMessages {
  constructor(web) {
    this.web = web;
  }

  async sendSlackMessageToComment(commentData, channelId) {
    try {
      const message = {
        channel: channelId,
        text: `*<${commentData.prUrl}|${commentData.prTitle}>*\n:pencil: *${commentData.reviewerSlackRealName}* 님이 코멘트를 남겼어요!! <@${commentData.ownerSlackId}>:\n`,
        attachments: [
          {
            color: 'good',
            text: `${commentData.commentBody}\n\n<${commentData.commentUrl}|코멘트 보러가기>.`,
          },
        ],
        mrkdwn: true,
      };

      await this.web.chat.postMessage(message);
    } catch (error) {
      console.error('Error sending Slack message:', error);
      throw error;
    }
  }

  async sendSlackMessageToApprove(commentData, channelId) {
    try {
      const message = {
        channel: channelId,
        text: `*<${commentData.prUrl}|${commentData.prTitle}>*\n:white_check_mark: *${commentData.reviewerSlackRealName}* 님이 Approve를 했습니다!! <@${commentData.ownerSlackId}>:\n`,
        attachments: [
          {
            color: 'good',
            text: `${commentData.commentBody}\n\n<${commentData.commentUrl}|코멘트 보러가기>.`,
          },
        ],
        mrkdwn: true,
      };

      await this.web.chat.postMessage(message);
    } catch (error) {
      console.error('Error sending Slack message:', error);
      throw error;
    }
  }

  async sendSlackMessageToReviewRequested(commentData, channelId) {
    try {
      const message = {
        channel: channelId,
        text: `*<${commentData.prUrl}|${commentData.prTitle}>*\n:eyes: *${commentData.ownerSlackRealName}* 님이 Review를 요청했습니다!! <@${commentData.reviewerSlackId}>:\n`,
        attachments: [
          {
            color: 'good',
            text: `${commentData.commentBody}\n\n<${commentData.prUrl}|PR 보러가기>.`,
          },
        ],
        mrkdwn: true,
      };

      await this.web.chat.postMessage(message);
    } catch (error) {
      console.error('Error sending Slack message:', error);
      throw error;
    }
  }
}

module.exports = SlackMessages;
