const { WebClient } = require('@slack/web-api');
const { Octokit } = require('@octokit/core');
const Core = require('@actions/core');
const Github = require('@actions/github');

const SLACK_TOKEN = Core.getInput('SLACK_TOKEN');
const GITHUB_TOKEN = Core.getInput('GITHUB_TOKEN');
const ACTION_TYPE = Core.getInput('ACTION_TYPE');
const OWNER_REPO = Core.getInput('OWNER_REPO');

const SLACK_FRONTEND_CHANNEL_ID = 'C06B5J3KD8F';
const SLACK_BACKEND_CHANNEL_ID = 'C06C8TLTURE';
const SLACK_SE_CHANNEL_ID = 'C06CS5Q4L8G';

async function run() {
  const web = new WebClient(SLACK_TOKEN);
  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  try {
    switch (ACTION_TYPE) {
      case 'approve':
        await handleApprove();
        break;
      case 'comment':
        await handleComment(octokit, web);
        break;
      default:
        console.log('error');
        break;
    }
  } catch (error) {
    console.error('Error executing action:', error);
  }

  console.log('Done!!');
}

async function handleApprove() {

}

async function handleComment(octokit) {
  const { payload } = Github.context;
  const commentUrl = payload.comment ? payload.comment.html_url : null;
  const prOwner = payload.issue ? payload.issue.user.login : null;
  const commanter = payload.comment ? payload.comment.user.login : null;
  const commentBody = payload.comment ? payload.comment.body : null;

  slackUserMapping(prOwner, commanter);
  if (commentBody && commanter && commentUrl) {
    sendSlackMessage(commentBody, commanter, commentUrl, prOwner);
  }
}

function slackUserMapping(prOwner, commanter) {

}
function sendSlackMessage(commentBody, commanter, commentUrl, prOwner) {
  const web = new WebClient(SLACK_TOKEN);

  const formattedComment = commentBody.split('\n').map((line) => `> ${line}`).join('\n');

  const message = {
    channel: SLACK_FRONTEND_CHANNEL_ID,
    text: `*${commanter}* commented on PR of *${prOwner}*:\nSee more <${commentUrl}|here>.`,
    attachments: [
      {
        color: 'good', // Slack에서 '좋음' 상태를 나타내는 기본 색상인 초록색을 사용합니다.
        text: formattedComment,
      },
    ],
    mrkdwn: true,
  };

  web.chat.postMessage(message);
}

run();
// (async () => {
//     // See: https://api.slack.com/methods/chat.postMessage
//     const res = await web.chat.postMessage({ channel: conversationId, text: 'Hello there' });
//
//     // `res` contains information about the posted message
//     console.log('Message sent: ', res.ts);
// })();
