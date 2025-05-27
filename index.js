const Core = require('@actions/core');
const Github = require('@actions/github');
const ServiceFactory = require('./services/serviceFactory');
const EventHandlerFactory = require('./handler/eventHandlerFactory');
const Logger = require('./utils/logger');
const ConfigValidator = require('./utils/configValidator');
const environment = require('./config/environment');
const { ACTION_TYPES } = require('./constants');
const { SlackNotificationError, ConfigurationError } = require('./utils/errors');

/**
 * @typedef {Object} ActionConfig
 * @property {Object} action
 * @property {Object} action.deploy
 * @property {string} action.deploy.ec2Name
 * @property {string} action.deploy.imageTag
 * @property {string} action.deploy.jobStatus
 * @property {Object} action.ci
 * @property {string} action.ci.branchName
 * @property {string} action.ci.imageTag
 * @property {string} action.ci.jobName
 * @property {string} action.ci.jobStatus
 */

/**
 * 에러 타입에 따른 메시지 생성
 * @param {Error} error - 발생한 에러
 * @returns {string} 에러 메시지
 */
function getErrorMessage(error) {
  if (error instanceof ConfigurationError) {
    return `설정 오류: ${error.message}`;
  }

  if (error instanceof SlackNotificationError) {
    return `처리 오류: ${error.message}`;
  }

  return `예기치 않은 오류: ${error.message}`;
}

/**
 * 액션 타입에 따른 이벤트 처리
 * @param {EventHandlerFactory} handlerFactory - 핸들러 팩토리
 * @param {string} actionType - 액션 타입
 * @param {Object} context - GitHub context
 * @param {ActionConfig} config - 액션 설정
 * @returns {Promise<any>} 처리 결과
 */
async function processActionEvent(handlerFactory, actionType, context, config) {
  Logger.info(`${actionType} 이벤트 처리 중`);

  switch (actionType) {
    case ACTION_TYPES.DEPLOY:
      return handlerFactory.handleEvent(
        ACTION_TYPES.DEPLOY,
        context,
        config.action.deploy.ec2Name,
        config.action.deploy.imageTag,
        config.action.deploy.jobStatus,
      );

    case ACTION_TYPES.CI:
      return handlerFactory.handleEvent(
        ACTION_TYPES.CI,
        context,
        config.action.ci.branchName,
        config.action.ci.imageTag,
        config.action.ci.jobName,
        config.action.ci.jobStatus,
      );

    default:
      return handlerFactory.handleEvent(actionType, context.payload);
  }
}

/**
 * GitHub Action 메인 실행 함수
 * @returns {Promise<any>} 실행 결과
 */
// eslint-disable-next-line consistent-return
async function run() {
  const startTime = Date.now();

  try {
    // 환경 설정 로드 및 검증
    const config = environment.load();
    const { actionType } = ConfigValidator.validateAll();

    Logger.info('Slack Notification Action 시작');
    Logger.info(`액션 타입: ${actionType}`);

    // GitHub 컨텍스트 검증
    const { context } = Github;
    // test
    console.log(context);
    ConfigValidator.validatePayload(context.payload);

    // 서비스 및 핸들러 생성
    const serviceFactory = ServiceFactory.getInstance();
    const eventHandlerFactory = new EventHandlerFactory(serviceFactory);

    // 이벤트 처리
    const result = await processActionEvent(eventHandlerFactory, actionType, context, config);

    const duration = Date.now() - startTime;
    Logger.info(`Action 실행 성공 (${duration}ms)`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = getErrorMessage(error);

    Logger.error(`Action 실행 실패 (${duration}ms)`, error);
    Core.setFailed(errorMessage);

    // GitHub Actions 어노테이션에 상세 정보 추가
    if (error.details) {
      Core.error(JSON.stringify(error.details, null, 2));
    }

    process.exit(1);
  }
}

/**
 * 처리되지 않은 Promise 거부 핸들러
 */
process.on('unhandledRejection', (reason) => {
  Logger.error('처리되지 않은 Promise 거부:', reason);
  Core.setFailed(`처리되지 않은 오류: ${reason}`);
  process.exit(1);
});

/**
 * 처리되지 않은 예외 핸들러
 */
process.on('uncaughtException', (error) => {
  Logger.error('처리되지 않은 예외:', error);
  Core.setFailed(`처리되지 않은 예외: ${error.message}`);
  process.exit(1);
});

// 메인 함수 실행
if (require.main === module) {
  run().catch((error) => {
    Logger.error('Action 실행 실패:', error);
    Core.setFailed(error.message);
    process.exit(1);
  });
}

module.exports = { run };
