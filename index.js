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
 * 액션 타입별 처리
 * @param {EventHandlerFactory} handlerFactory
 * @param {string} actionType
 * @param {Object} context
 * @param {Object} config
 * @returns {Promise<any>}
 */
async function processAction(handlerFactory, actionType, context, config) {
  Logger.info(`${actionType} 이벤트 처리 중`);
  Logger.debug('페이로드:', context.payload);

  switch (actionType) {
    case ACTION_TYPES.DEPLOY: {
      const deployConfig = config.action.deploy;
      return handlerFactory.handleEvent(
        ACTION_TYPES.DEPLOY,
        context,
        deployConfig.ec2Name,
        deployConfig.imageTag,
        deployConfig.jobStatus,
      );
    }

    case ACTION_TYPES.CI: {
      const ciConfig = config.action.ci;
      return handlerFactory.handleEvent(
        ACTION_TYPES.CI,
        context,
        ciConfig.branchName,
        ciConfig.imageTag,
        ciConfig.jobName,
        ciConfig.jobStatus,
      );
    }

    default:
      return handlerFactory.handleEvent(actionType, context.payload);
  }
}

/**
 * GitHub Action 메인 실행 함수
 */
// eslint-disable-next-line consistent-return
async function run() {
  const startTime = Date.now();
  const serviceFactory = ServiceFactory.getInstance();
  const eventHandlerFactory = new EventHandlerFactory(serviceFactory);

  try {
    // 환경 설정 로드
    const config = environment.load();
    Logger.info('Slack Notification Action 시작');
    Logger.debug('환경 설정:', environment.toSafeObject());

    // 설정 검증
    const { actionType } = ConfigValidator.validateAll();
    Logger.info(`액션 타입: ${actionType}`);

    // GitHub 컨텍스트 검증
    const { context } = Github;
    ConfigValidator.validatePayload(context.payload);

    // 핸들러 사전 초기화 (성능 최적화)
    await eventHandlerFactory.preInitialize();

    // 액션 타입별 처리
    const result = await processAction(eventHandlerFactory, actionType, context, config);

    // 성공 로깅
    const duration = Date.now() - startTime;
    Logger.info(`Action 실행 성공 (${duration}ms)`);

    // 캐시 통계 로깅 (디버그 모드)
    if (environment.isDebug()) {
      const cacheStats = eventHandlerFactory.getCacheStats();
      Logger.debug('캐시 통계:', cacheStats);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    // 에러 처리
    if (error instanceof ConfigurationError) {
      Logger.error(`설정 오류 (${duration}ms)`, error);
      Core.setFailed(`설정 오류: ${error.message}`);
    } else if (error instanceof SlackNotificationError) {
      Logger.error(`처리 오류 (${duration}ms)`, error);
      Core.setFailed(`처리 오류: ${error.message}`);
    } else {
      Logger.error(`예기치 않은 오류 (${duration}ms)`, error);
      Core.setFailed(`예기치 않은 오류: ${error.message}`);
    }

    // GitHub Actions 어노테이션 추가
    if (error.details) {
      Core.error(JSON.stringify(error.details, null, 2));
    }

    process.exit(1);
  } finally {
    // 리소스 정리
    if (eventHandlerFactory) {
      await eventHandlerFactory.cleanup();
    }
    if (serviceFactory) {
      serviceFactory.cleanup();
    }
  }
}

/**
 * 에러 핸들러 설정
 */
process.on('unhandledRejection', (reason) => {
  Logger.error('처리되지 않은 Promise 거부:', reason);
  Core.setFailed(`처리되지 않은 오류: ${reason}`);
  process.exit(1);
});

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
