async function handleComment(octokit, web) {
  const { payload } = Github.context;
  const commentData = {
    commentUrl: payload.comment?.html_url,
    prOwnerGitName: payload.issue?.user.login ?? payload.pull_request?.user.login,
    prUrl: payload.issue?.html_url ?? payload.pull_request?.html_url,
    commenterGitName: payload.comment?.user.login,
    commentBody: payload.comment?.body,
    prTitle: payload.issue?.title ?? payload.pull_request?.title,
  };

  const channelId = await selectSlackChannel(octokit, commentData.prOwnerGitName);
  commentData.ownerSlackId = await getSlackUserProperty(octokit, web, commentData.prOwnerGitName, 'id');
  commentData.commenterSlackRealName = await getSlackzUserProperty(octokit, web, commentData.commenterGitName, 'realName');

  if (commentData.commentBody && commentData.commenterGitName && commentData.commentUrl) {
    await sendSlackMessageToComment(commentData, channelId);
  }
}

async function handleApprove() {

}

module.exports = handleComment;
