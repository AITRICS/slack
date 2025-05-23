const { WebClient } = require('@slack/web-api');
const { Octokit } = require('@octokit/rest');
const Core = require('@actions/core');
const Github = require('@actions/github');
const EventHandlerFactory = require('./handler/eventHandlerFactory');
const Logger = require('./utils/logger');
const { ACTION_TYPES } = require('./constants');

const SLACK_TOKEN = Core.getInput('SLACK_TOKEN');
const GITHUB_TOKEN = Core.getInput('GITHUB_TOKEN');
const ACTION_TYPE = Core.getInput('ACTION_TYPE');

/**
 * Main function to run the GitHub Action
 */
async function run() {
  const web = new WebClient(SLACK_TOKEN);
  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const handlerFactory = new EventHandlerFactory(octokit, web);

  const { context } = Github;

  if (!context.payload) {
    Logger.error('Invalid payload');
    process.exit(1);
  }

  Logger.info(context.payload);

  try {
    Logger.info(`Processing ${ACTION_TYPE} event`);
    Logger.debug('Payload:', context.payload);

    switch (ACTION_TYPE) {
      case ACTION_TYPES.DEPLOY: {
        const ec2Name = Core.getInput('EC2_NAME');
        const imageTag = Core.getInput('IMAGE_TAG');
        const jobStatus = Core.getInput('JOB_STATUS');
        await handlerFactory.handleEvent(ACTION_TYPE, context, ec2Name, imageTag, jobStatus);
        break;
      }
      case ACTION_TYPES.CI: {
        const branchName = Core.getInput('BRANCH_NAME');
        const imageTag = Core.getInput('IMAGE_TAG');
        const jobName = Core.getInput('JOB_NAME');
        const jobStatus = Core.getInput('JOB_STATUS');
        await handlerFactory.handleEvent(ACTION_TYPE, context, branchName, imageTag, jobName, jobStatus);
        break;
      }
      default:
        await handlerFactory.handleEvent(ACTION_TYPE, context.payload);
    }

    Logger.info('Message sent to Slack!');
  } catch (error) {
    Logger.error('Error executing action:', error);
    process.exit(1);
  }
}

run();
