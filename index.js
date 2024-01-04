const { WebClient } = require('@slack/web-api');
const { Octokit } = require("@octokit/core");
const Core = require("@actions/core");
const Github = require('@actions/github');

const SLACK_TOKEN = Core.getInput("SLACK_TOKEN");
const GITHUB_TOKEN = Core.getInput("GITHUB_TOKEN");
const ACTION_TYPE = Core.getInput("ACTION_TYPE");
const OWNER_REPO = Core.getInput("OWNER_REPO");

const SLACK_FRONTEND_CHANNEL_ID = 'C06B5J3KD8F';
const SLACK_BACKEND_CHANNEL_ID =  'C06C8TLTURE';
const SLACK_SE_CHANNEL_ID = 'C06CS5Q4L8G';

async function run() {
    const web = new WebClient(SLACK_TOKEN);
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    switch (ACTION_TYPE) {
        case 'approve':
            await handleApprove();
            break;
        case 'comment':
            await handleComment(octokit);
            break;
        default:
            console.log('error');
            break;
    }
    const payload = Github.context.payload;
    const commentUrl = payload.comment ? payload.comment.html_url : null;
    const commentId = payload.comment ? payload.comment.id : null;
    const prOwner = payload.pull_request ? payload.pull_request.user.login : null;

    console.log("Comment ID:", commentId);
    console.log(payload);
    console.log('Done!!');
}

async function handleApprove() {

}

async function handleComment(octokit) {
    const payload = Github.context.payload;
    const commentUrl = payload.comment ? payload.comment.html_url : null;
    const commentId = payload.comment ? payload.comment.id : null;
    const prOwner = payload.pull_request ? payload.pull_request.user.login : null;
    const commanter = payload.comment ? payload.comment.user.login : null;
    const commentBody = payload.comment ? payload.comment.body : null;

    sendSlackMessage(commentBody, commanter, commentUrl, prOwner);
}

function sendSlackMessage(commentBody, commanter, commentUrl, prOwner) {
    const web = new WebClient(SLACK_TOKEN);
    const channel = getChannel(prOwner);

    web.chat.postMessage({
        channel: SLACK_FRONTEND_CHANNEL_ID,
        text: `*${commenter}* commented on PR <${commentUrl}|${commentBody}>`
    });
}

run();
// (async () => {
//     // See: https://api.slack.com/methods/chat.postMessage
//     const res = await web.chat.postMessage({ channel: conversationId, text: 'Hello there' });
//
//     // `res` contains information about the posted message
//     console.log('Message sent: ', res.ts);
// })();
