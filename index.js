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

async function slackUserMapping(octokit, web, prOwner, commanter) {
  const ownerName = await getUserNameToGitHub(octokit, prOwner);
  const commanterName = await getUserNameToGitHub(octokit, commanter);

  const ownerSlackId = await findSlackUserIdByName(web, ownerName);
  const commanterSlackId = await findSlackUserIdByName(web, commanterName);
  return { ownerSlackId, commanterSlackId };
}

async function getUserNameToGitHub(octokit, githubName) {
  try {
    const res = await octokit.request('GET /users/{username}', {
      username: githubName,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    return res.data.name; // GitHub 사용자의 실제 이름 반환
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null; // 에러 발생 시 null 반환
  }
}

function sendSlackMessage(commentBody, commanter, commentUrl, prOwner, prTitle, prUrl) {
  const web = new WebClient(SLACK_TOKEN);

  const message = {
    channel: SLACK_FRONTEND_CHANNEL_ID,
    text: `*<${prUrl}|${prTitle}>*\n*${commanter}* 코멘트를 남겼어요!! *${prOwner}*:\n`,
    attachments: [
      {
        color: 'good',
        text: `${commentBody}\n\n<${commentUrl}|코멘트 보러가기>.`,
      },
    ],
    mrkdwn: true,
  };

  web.chat.postMessage(message);
}

async function handleComment(octokit, web) {
  const { payload } = Github.context;
  const commentUrl = payload.comment ? payload.comment.html_url : null;
  const prOwner = payload.issue ? payload.issue.user.login : null;
  const prUrl = payload.issue ? payload.issue.html_url : null;
  const commanter = payload.comment ? payload.comment.user.login : null;
  const commentBody = payload.comment ? payload.comment.body : null;
  const prTitle = payload.issue ? payload.issue.title : null;

  const { ownerSlackId, commanterSlackId } = await slackUserMapping(octokit, web, prOwner, commanter);
  if (commentBody && commanter && commentUrl) {
    sendSlackMessage(commentBody, commanterSlackId, commentUrl, ownerSlackId, prTitle, prUrl);
  }
}

async function findSlackUserIdByName(web, searchName) {
  const result = await web.users.list();
  const user = result.members.find((member) => (
    member.real_name && member.real_name.includes(searchName))
      || (member.profile.display_name && member.profile.display_name.includes(searchName)));
  return user ? user.id : searchName;
}

run();
// (async () => {
//     // See: https://api.slack.com/methods/chat.postMessage
//     const res = await web.chat.postMessage({ channel: conversationId, text: 'Hello there' });
//
//     // `res` contains information about the posted message
//     console.log('Message sent: ', res.ts);
// })();
