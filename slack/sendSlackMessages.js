/**
 * Sends a message to a Slack channel based on the provided comment data from GitHub.
 * @param {WebClient} web - The Slack WebClient instance for sending messages.
 * @param {object} commentData - An object containing details about the GitHub comments.
 * @param {string} channelId - The Slack channel ID where the message should be sent.
 * @returns {Promise<void>} A promise that resolves when the message is sent.
 * @throws Will throw an error if the Slack API request fails.
 */
async function sendSlackMessageToComment(web, commentData, channelId) {
  try {
    const message = {
      channel: channelId,
      text: `*<${commentData.prUrl}|${commentData.prTitle}>*\n*${commentData.commenterSlackRealName}* 님이 코멘트를 남겼어요!! <@${commentData.ownerSlackId}>:\n`,
      attachments: [
        {
          color: 'good',
          text: `${commentData.commentBody}\n\n<${commentData.commentUrl}|코멘트 보러가기>.`,
        },
      ],
      mrkdwn: true,
    };

    await web.chat.postMessage(message);
  } catch (error) {
    console.error('Error sending Slack message:', error);
    throw error;
  }
}

module.exports = sendSlackMessageToComment;
