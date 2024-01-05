const { WebClient } = require('@slack/web-api');
const { Octokit } = require('@octokit/rest');
const Core = require('@actions/core');
const Github = require('@actions/github');

const SLACK_TOKEN = Core.getInput('SLACK_TOKEN');
const GITHUB_TOKEN = Core.getInput('GITHUB_TOKEN');
const ACTION_TYPE = Core.getInput('ACTION_TYPE');
const TEAM_SLUGS = ['SE', 'Platform-frontend', 'Platform-backend'];
const SLACK_CHANNEL = {
  SE: 'C06CS5Q4L8G',
  'Platform-frontend': 'C06B5J3KD8F',
  'Platform-backend': 'C06C8TLTURE',
  'git-any': 'C06CMAY8066',
};

async function handleApprove() {

}

async function selectSlackCheannel(octokit, githubName) {
  const memberChecks = TEAM_SLUGS.map(async (teamSlug) => {
    const memberList = await octokit.teams.listMembersInOrg({
      org: 'aitrics',
      team_slug: teamSlug,
    });

    const member = memberList.data.find(({ login }) => login === githubName);
    return member ? teamSlug : null;
  });

  const results = await Promise.all(memberChecks);
  const foundTeamSlug = results.find((slug) => slug !== null);
  return foundTeamSlug ? SLACK_CHANNEL[foundTeamSlug] : SLACK_CHANNEL['git-any'];
}

async function getGithubNickNameToGitHub(octokit, githubName) {
  const res = await octokit.rest.users.getByUsername({
    username: githubName,
  });
  return res.data.name; // GitHub 사용자의 실제 이름 반환
}

function sendSlackMessage(commentData, channelId) {
  const web = new WebClient(SLACK_TOKEN);

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
    commentUrl: payload.comment?.html_url,
    prOwnerGitName: payload.issue?.user.login ?? payload.pull_request?.user.login,
    prUrl: payload.issue?.html_url ?? payload.pull_request?.html_url,
    commenterGitName: payload.comment?.user.login,
    commentBody: payload.comment?.body,
    prTitle: payload.issue?.title ?? payload.pull_request?.title,
  };
  const channelId = await selectSlackCheannel(octokit, commentData.prOwnerGitName);
  commentData.ownerSlackId = await getSlackUserProperty(octokit, web, commentData.prOwnerGitName, 'id');
  commentData.commenterSlackRealName = await getSlackUserProperty(octokit, web, commentData.commenterGitName, 'realName');

  if (commentData.commentBody && commentData.commenterGitName && commentData.commentUrl) {
    sendSlackMessage(commentData, channelId);
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
