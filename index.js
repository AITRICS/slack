const { WebClient } = require('@slack/web-api');
const { Octokit } = require('@octokit/rest');
const Core = require('@actions/core');
const Github = require('@actions/github');
const EventHandler = require('./handler/eventHandler');

const SLACK_TOKEN = Core.getInput('SLACK_TOKEN');
const GITHUB_TOKEN = Core.getInput('GITHUB_TOKEN');
const ACTION_TYPE = Core.getInput('ACTION_TYPE');

async function run() {
  const web = new WebClient(SLACK_TOKEN);
  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const { payload } = Github.context;
  const handler = new EventHandler(octokit, web);

  try {
    switch (ACTION_TYPE) {
      case 'approve':
        await handler.handleApprove();
        break;
      case 'comment':
        await handler.handleComment(payload);
        break;
      default:
        console.log('error');
        break;
    }
  } catch (error) {
    console.error('Error executing action:', error);
  }

  console.log(payload.data);
  console.log('Done!!');
}

run();
