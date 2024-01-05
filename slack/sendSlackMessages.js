async function sendSlackMessageToComment(web, commentData, channelId) {
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
}

module.exports = sendSlackMessageToComment;
