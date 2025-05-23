const BaseEventHandler = require('./baseEventHandler');
const { SLACK_CONFIG, SLACK_CHANNELS } = require('../constants');
const { calculateDurationInMinutes, formatDuration } = require('../utils/timeUtils');

/**
 * Handles deployment and build events
 */
class DeploymentEventHandler extends BaseEventHandler {
  /**
   * Handles deployment events
   */
  async handleDeploy(context, ec2Name, imageTag, jobStatus) {
    const deployData = await this.prepareDeployData(context, ec2Name, imageTag, jobStatus);
    const notificationData = DeploymentEventHandler.formatDeploymentNotificationData(deployData);

    await this.slackMessageService.sendDeploymentMessage(notificationData, SLACK_CHANNELS.deploy);
  }

  /**
   * Handles build events
   */
  async handleBuild(context, branchName, imageTag, jobName, jobStatus) {
    const buildData = await this.prepareBuildData(context, branchName, imageTag, jobName, jobStatus);
    const notificationData = DeploymentEventHandler.formatBuildNotificationData(buildData);

    await this.slackMessageService.sendBuildMessage(notificationData, SLACK_CHANNELS.deploy);
  }

  async prepareDeployData(context, ec2Name, imageTag, jobStatus) {
    const repoData = BaseEventHandler.extractRepoData(context.payload.repository);
    const workflowData = await this.gitHubApiHelper.fetchWorkflowRunData(repoData.name, context.runId);
    const totalDurationMinutes = calculateDurationInMinutes(workflowData.run_started_at, new Date());
    const triggerUser = await this.slackUserService.getSlackUserPropertyByGithubUsername(
      workflowData.actor.login,
      'id',
    );

    const isSuccess = jobStatus === 'success';

    return {
      ec2Name,
      imageTag,
      repoData,
      ref: context.ref,
      sha: context.sha,
      slackStatus: isSuccess ? SLACK_CONFIG.MESSAGE_COLORS.SUCCESS : SLACK_CONFIG.MESSAGE_COLORS.DANGER,
      slackDeployResult: `${isSuccess ? SLACK_CONFIG.ICONS.SUCCESS : SLACK_CONFIG.ICONS.FAILURE}*${isSuccess ? 'Succeeded' : 'Failed'}*`,
      totalRunTime: formatDuration(totalDurationMinutes),
      triggerUser,
      workflowData,
    };
  }

  async prepareBuildData(context, branchName, imageTag, jobName, jobStatus) {
    const repoData = BaseEventHandler.extractRepoData(context.payload.repository);
    const workflowData = await this.gitHubApiHelper.fetchWorkflowRunData(repoData.name, context.runId);
    const totalDurationMinutes = calculateDurationInMinutes(workflowData.run_started_at, new Date());
    const triggerUser = await this.slackUserService.getSlackUserPropertyByGithubUsername(
      workflowData.actor.login,
      'id',
    );

    const jobNames = jobName ? jobName.split(',').map((name) => name.trim()) : [];
    const isSuccess = jobStatus === 'success';

    return {
      branchName: branchName || context.ref.replace('refs/heads/', ''),
      jobNames,
      imageTag,
      repoData,
      sha: context.sha,
      slackStatus: isSuccess ? SLACK_CONFIG.MESSAGE_COLORS.SUCCESS : SLACK_CONFIG.MESSAGE_COLORS.DANGER,
      slackBuildResult: `${isSuccess ? SLACK_CONFIG.ICONS.SUCCESS : SLACK_CONFIG.ICONS.FAILURE}*${isSuccess ? 'Succeeded' : 'Failed'}*`,
      totalRunTime: formatDuration(totalDurationMinutes),
      triggerUser,
      workflowData,
    };
  }

  static formatDeploymentNotificationData(deployData) {
    const {
      ec2Name,
      imageTag,
      repoData,
      ref,
      sha,
      slackStatus,
      slackDeployResult,
      totalRunTime,
      triggerUser,
      workflowData,
    } = deployData;

    return {
      ec2Name,
      imageTag,
      ref,
      sha,
      slackStatus,
      slackDeployResult,
      triggerUser,
      repoName: repoData.name,
      repoFullName: repoData.fullName,
      repoUrl: repoData.url,
      commitUrl: `https://github.com/${repoData.fullName}/commit/${sha}`,
      workflowName: workflowData.name,
      totalRunTime,
      actionUrl: workflowData.html_url,
    };
  }

  static formatBuildNotificationData(buildData) {
    const {
      branchName,
      imageTag,
      repoData,
      ref,
      sha,
      slackStatus,
      slackBuildResult,
      totalRunTime,
      triggerUser,
      workflowData,
      jobNames,
    } = buildData;

    return {
      branchName,
      imageTag,
      ref,
      sha,
      slackStatus,
      slackBuildResult,
      triggerUser,
      repoName: repoData.name,
      repoFullName: repoData.fullName,
      repoUrl: repoData.url,
      commitUrl: `https://github.com/${repoData.fullName}/commit/${sha}`,
      workflowName: workflowData.name,
      totalRunTime,
      actionUrl: workflowData.html_url,
      jobNames,
    };
  }
}

module.exports = DeploymentEventHandler;
