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
 * @param {Error} error
 * @returns {string}
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
 * 실행 성공 로깅
 * @param {number} startTime
 * @param {EventHandlerFactory} handlerFactory
 */
function logExecutionSuccess(startTime, handlerFactory) {
  const executionDuration = Date.now() - startTime;
  Logger.info(`Action 실행 성공 (${executionDuration}ms)`);

  // 디버그 모드에서 캐시 통계 출력
  if (environment.isDebug()) {
    const cacheStats = handlerFactory.getCacheStats();
    Logger.debug('캐시 통계:', cacheStats);
  }
}

/**
 * 실행 에러 처리
 * @param {Error} error
 * @param {number} startTime
 */
function handleExecutionError(error, startTime) {
  const executionDuration = Date.now() - startTime;
  const errorMessage = getErrorMessage(error);

  Logger.error(`Action 실행 실패 (${executionDuration}ms)`, error);
  Core.setFailed(errorMessage);

  // GitHub Actions 어노테이션에 상세 정보 추가
  if (error.details) {
    Core.error(JSON.stringify(error.details, null, 2));
  }

  process.exit(1);
}

/**
 * 리소스 정리
 * @param {EventHandlerFactory} handlerFactory
 * @param {ServiceFactory} serviceFactory
 */
async function cleanupResources(handlerFactory, serviceFactory) {
  try {
    if (handlerFactory) {
      await handlerFactory.cleanup();
    }
    if (serviceFactory) {
      serviceFactory.cleanup();
    }
  } catch (cleanupError) {
    Logger.error('리소스 정리 중 오류 발생', cleanupError);
  }
}

/**
 * 액션 타입에 따른 이벤트 처리
 * @param {EventHandlerFactory} handlerFactory
 * @param {string} actionType
 * @param {Object} context
 * @param {ActionConfig} config
 * @returns {Promise<any>}
 */
async function processActionEvent(handlerFactory, actionType, context, config) {
  Logger.info(`${actionType} 이벤트 처리 중`);
  Logger.debug('GitHub 컨텍스트 페이로드:', context.payload);

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
 */
async function run() {
  const executionStartTime = Date.now();
  const serviceFactory = ServiceFactory.getInstance();
  const eventHandlerFactory = new EventHandlerFactory(serviceFactory);

  try {
    // 환경 설정 로드 및 검증
    const config = environment.load();
    const { actionType } = ConfigValidator.validateAll();

    Logger.info('Slack Notification Action 시작');
    Logger.info(`액션 타입: ${actionType}`);
    Logger.debug('환경 설정:', environment.toSafeObject());

    // GitHub 컨텍스트 검증
    const { context } = Github;
    ConfigValidator.validatePayload(context.payload);

    // 핸들러 사전 초기화로 성능 최적화
    await eventHandlerFactory.preInitialize();

    // 액션 타입별 이벤트 처리
    const result = await processActionEvent(eventHandlerFactory, actionType, context, config);

    logExecutionSuccess(executionStartTime, eventHandlerFactory);
    return result;
  } catch (error) {
    handleExecutionError(error, executionStartTime);
    return null;
  } finally {
    await cleanupResources(eventHandlerFactory, serviceFactory);
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
