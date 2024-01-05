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

async function handleApprove() {

}

async function getGithubNickNameToGitHub(octokit, githubName) {
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

function sendSlackMessage(commentData) {
  const web = new WebClient(SLACK_TOKEN);

  const message = {
    channel: SLACK_FRONTEND_CHANNEL_ID,
    text: `*<${commentData.prUrl}|${commentData.prTitle}>*\n*${commentData.commenterSlackRealName}* 님이 코멘트를 남겼어요!! <@${commentData.ownerSlackId}>:\n`,
    attachments: [
      {
        color: 'good',
        text: `${commentData.commentBody}\n\n<${commentData.commentUrl}|코멘트 보러가기>.`,
      },
    ],
    mrkdwn: true,
  };

  web.chat.postMessage(message);
}

async function findSlackUserPropertyByGitName(web, searchName, property) {
  const slackUserList = await web.users.list();
  const lowerCaseSearchName = searchName.toLowerCase();

  const user = slackUserList.members.find(({ real_name: realName, profile }) => {
    const nameToCheck = [realName, profile.display_name].map((name) => name?.toLowerCase());
    return nameToCheck.some((name) => name?.includes(lowerCaseSearchName));
  });

  if (user) {
    if (property === 'id') {
      return user.id;
    }
    if (property === 'realName') {
      return user.profile.display_name;
    }
  }

  return searchName;
}

async function getSlackUserProperty(octokit, web, searchName, property) {
  const githubNickName = await getGithubNickNameToGitHub(octokit, searchName);
  return findSlackUserPropertyByGitName(web, githubNickName, property);
}

async function handleComment(octokit, web) {
  const { payload } = Github.context;
  const commentData = {
    commentUrl: payload.comment ? payload.comment.html_url : null,
    prOwnerGitName: payload.issue ? payload.issue.user.login : null,
    prUrl: payload.issue ? payload.issue.html_url : null,
    commenterGitName: payload.comment ? payload.comment.user.login : null,
    commentBody: payload.comment ? payload.comment.body : null,
    prTitle: payload.issue ? payload.issue.title : null,
  };

  commentData.ownerSlackId = await getSlackUserProperty(octokit, web, commentData.prOwnerGitName, 'id');
  commentData.commenterSlackRealName = await getSlackUserProperty(octokit, web, commentData.commenterGitName, 'realName');

  if (commentData.commentBody && commentData.commenterGitName && commentData.commentUrl) {
    sendSlackMessage(commentData);
  }
}

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

run();
// (async () => {
//     // See: https://api.slack.com/methods/chat.postMessage
//     const res = await web.chat.postMessage({ channel: conversationId, text: 'Hello there' });
//
//     // `res` contains information about the posted message
//     console.log('Message sent: ', res.ts);
// })();
