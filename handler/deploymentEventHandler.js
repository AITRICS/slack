const { SLACK_CHANNELS } = require('../constants');
const { calculateDurationInMinutes, formatDuration } = require('../utils/timeUtils');
const Logger = require('../utils/logger');
const BaseEventHandler = require('./baseEventHandler');

/**
 * 배포 및 빌드 이벤트 처리
 */
class DeploymentEventHandler extends BaseEventHandler {
  /**
   * 배포 이벤트 처리
   * @param {GitHubContext} context - GitHub context
   * @param {string} ec2Name - EC2 instance name
   * @param {string} imageTag - Docker image tag
   * @param {string} jobStatus - Job status (success/failure)
   * @returns {Promise<void>}
   * @throws {Error} 배포 이벤트 처리 실패 시
   */
  async handleDeploy(context, ec2Name, imageTag, jobStatus) {
    try {
      Logger.info(`배포 이벤트 처리 시작: ${ec2Name}, 상태: ${jobStatus}`);

      await this.initialize();
      BaseEventHandler.validatePayload(context.payload);

      const deployData = await this.#prepareDeployData(context, ec2Name, imageTag, jobStatus);
      const notificationData = DeploymentEventHandler.#formatDeploymentNotificationData(deployData);

      await this.slackMessageService.sendDeploymentMessage(notificationData, SLACK_CHANNELS.deploy);

      Logger.info(`배포 알림 전송 완료: ${ec2Name}`);
    } catch (error) {
      Logger.error('배포 이벤트 처리 실패', error);
      throw error;
    }
  }

  /**
   * 빌드 이벤트 처리
   * @param {GitHubContext} context - GitHub context
   * @param {string} branchName - Branch name
   * @param {string} imageTag - Docker image tag
   * @param {string} jobName - Job name(s) (comma-separated)
   * @param {string} jobStatus - Job status (success/failure)
   * @returns {Promise<void>}
   * @throws {Error} 빌드 이벤트 처리 실패 시
   */
  async handleBuild(context, branchName, imageTag, jobName, jobStatus) {
    try {
      Logger.info(`빌드 이벤트 처리 시작: ${branchName}, 상태: ${jobStatus}`);

      await this.initialize();
      BaseEventHandler.validatePayload(context.payload);

      const buildData = await this.#prepareBuildData(context, branchName, imageTag, jobName, jobStatus);
      const notificationData = DeploymentEventHandler.#formatBuildNotificationData(buildData);

      await this.slackMessageService.sendBuildMessage(notificationData, SLACK_CHANNELS.deploy);

      Logger.info(`빌드 알림 전송 완료: ${branchName}`);
    } catch (error) {
      Logger.error('빌드 이벤트 처리 실패', error);
      throw error;
    }
  }

  /**
   * 배포 데이터 준비
   * @private
   * @param {GitHubContext} context - GitHub context
   * @param {string} ec2Name - EC2 instance name
   * @param {string} imageTag - Docker image tag
   * @param {string} jobStatus - Job status
   * @returns {Promise<PreparedDeployData>} 배포 데이터
   */
  async #prepareDeployData(context, ec2Name, imageTag, jobStatus) {
    const repoData = BaseEventHandler.extractRepoData(context.payload.repository);
    const workflowData = await this.gitHubApiHelper.fetchWorkflowRunData(repoData.name, context.runId);
    const totalDurationMinutes = calculateDurationInMinutes(workflowData.run_started_at, new Date());

    // Slack ID 조회
    const triggerUserMap = await this.slackUserService.getSlackProperties(
      [workflowData.actor.login],
      'id',
    );
    const triggerUser = triggerUserMap.get(workflowData.actor.login) || workflowData.actor.login;

    const isSuccess = jobStatus === 'success';

    return {
      ec2Name,
      imageTag,
      repoData,
      ref: context.ref,
      sha: context.sha,
      status: jobStatus,
      isSuccess,
      totalRunTime: formatDuration(totalDurationMinutes),
      triggerUser,
      workflowData,
    };
  }

  /**
   * 빌드 데이터 준비
   * @private
   * @param {GitHubContext} context - GitHub context
   * @param {string} branchName - Branch name
   * @param {string} imageTag - Docker image tag
   * @param {string} jobName - Job name(s)
   * @param {string} jobStatus - Job status
   * @returns {Promise<PreparedBuildData>} 빌드 데이터
   */
  async #prepareBuildData(context, branchName, imageTag, jobName, jobStatus) {
    const repoData = BaseEventHandler.extractRepoData(context.payload.repository);
    const workflowData = await this.gitHubApiHelper.fetchWorkflowRunData(repoData.name, context.runId);
    const totalDurationMinutes = calculateDurationInMinutes(workflowData.run_started_at, new Date());

    // Slack ID 조회
    const triggerUserMap = await this.slackUserService.getSlackProperties(
      [workflowData.actor.login],
      'id',
    );
    const triggerUser = triggerUserMap.get(workflowData.actor.login) || workflowData.actor.login;

    const jobNames = jobName ? jobName.split(',').map((name) => name.trim()).filter(Boolean) : [];
    const isSuccess = jobStatus === 'success';

    return {
      branchName: branchName || context.ref.replace('refs/heads/', ''),
      jobNames,
      imageTag,
      repoData,
      sha: context.sha,
      status: jobStatus,
      isSuccess,
      totalRunTime: formatDuration(totalDurationMinutes),
      triggerUser,
      workflowData,
    };
  }

  /**
   * 배포 알림 데이터 포맷
   * @private
   * @static
   * @param {PreparedDeployData} deployData - 배포 데이터
   * @returns {DeploymentData} 포맷된 알림 데이터
   */
  static #formatDeploymentNotificationData(deployData) {
    const {
      ec2Name,
      imageTag,
      repoData,
      ref,
      sha,
      status,
      totalRunTime,
      triggerUser,
      workflowData,
    } = deployData;

    return {
      status,
      ec2Name,
      imageTag,
      ref,
      sha,
      triggerUsername: triggerUser,
      repoName: repoData.name,
      repoUrl: repoData.url,
      duration: totalRunTime,
      workflowName: workflowData.name,
      workflowUrl: workflowData.html_url,
    };
  }

  /**
   * 빌드 알림 데이터 포맷
   * @private
   * @static
   * @param {PreparedBuildData} buildData - 빌드 데이터
   * @returns {DeploymentData} 포맷된 알림 데이터
   */
  static #formatBuildNotificationData(buildData) {
    const {
      branchName,
      imageTag,
      repoData,
      sha,
      status,
      totalRunTime,
      triggerUser,
      workflowData,
      jobNames,
    } = buildData;

    return {
      status,
      branchName,
      imageTag,
      sha,
      triggerUsername: triggerUser,
      repoName: repoData.name,
      repoUrl: repoData.url,
      duration: totalRunTime,
      workflowName: workflowData.name,
      workflowUrl: workflowData.html_url,
      jobNames,
    };
  }
}

module.exports = DeploymentEventHandler;
