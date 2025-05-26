const CommentEventHandler = require('./commentEventHandler');
const ReviewEventHandler = require('./reviewEventHandler');
const DeploymentEventHandler = require('./deploymentEventHandler');
const { ACTION_TYPES } = require('../constants');
const Logger = require('../utils/logger');
const { SlackNotificationError } = require('../utils/errors');

/**
 * 이벤트 핸들러 팩토리 (의존성 주입 패턴 적용)
 */
class EventHandlerFactory {
  /**
   * @param {import('../services/serviceFactory')} serviceFactory - 서비스 팩토리
   */
  constructor(serviceFactory) {
    this.serviceFactory = serviceFactory;
    this.services = serviceFactory.createServices();
    this.handlers = new Map();
    this.isInitialized = false;

    this._registerHandlers();
  }

  /**
   * 핸들러 등록
   * @private
   */
  _registerHandlers() {
    // 핸들러 인스턴스 생성
    const commentHandler = new CommentEventHandler(this.services);
    const reviewHandler = new ReviewEventHandler(this.services);
    const deploymentHandler = new DeploymentEventHandler(this.services);

    // 액션 타입별 핸들러 매핑
    this.handlers.set(ACTION_TYPES.COMMENT, {
      handler: commentHandler,
      method: 'handle',
    });

    this.handlers.set(ACTION_TYPES.APPROVE, {
      handler: reviewHandler,
      method: 'handleApprove',
    });

    this.handlers.set(ACTION_TYPES.REVIEW_REQUESTED, {
      handler: reviewHandler,
      method: 'handleReviewRequested',
    });

    this.handlers.set(ACTION_TYPES.CHANGES_REQUESTED, {
      handler: reviewHandler,
      method: 'handleReviewRequested',
    });

    this.handlers.set(ACTION_TYPES.SCHEDULE, {
      handler: reviewHandler,
      method: 'handleSchedule',
    });

    this.handlers.set(ACTION_TYPES.DEPLOY, {
      handler: deploymentHandler,
      method: 'handleDeploy',
    });

    this.handlers.set(ACTION_TYPES.CI, {
      handler: deploymentHandler,
      method: 'handleBuild',
    });

    Logger.debug(`${this.handlers.size}개의 핸들러 등록됨`);
  }

  /**
   * 모든 핸들러 사전 초기화
   * @returns {Promise<void>}
   */
  async preInitialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      Logger.info('이벤트 핸들러 사전 초기화 중...');
      Logger.time('핸들러 초기화');

      // 고유한 핸들러들만 추출
      const uniqueHandlers = new Set(
        Array.from(this.handlers.values()).map((entry) => entry.handler),
      );

      // 병렬로 초기화
      await Promise.all(
        Array.from(uniqueHandlers).map((handler) => handler.initialize()),
      );

      // 서비스도 초기화
      await this.serviceFactory.initializeAllServices();

      this.isInitialized = true;

      Logger.timeEnd('핸들러 초기화');
      Logger.info('모든 이벤트 핸들러 사전 초기화 완료');
    } catch (error) {
      Logger.error('이벤트 핸들러 사전 초기화 실패', error);
      // 초기화 실패해도 개별 핸들러는 동작 가능하도록 에러를 던지지 않음
    }
  }

  /**
   * 액션 타입에 해당하는 핸들러 정보 가져오기
   * @param {string} actionType
   * @returns {{handler: Object, method: string}|null}
   */
  getHandlerInfo(actionType) {
    const handlerInfo = this.handlers.get(actionType);

    if (!handlerInfo) {
      Logger.error(`핸들러를 찾을 수 없음: ${actionType}`);
      return null;
    }

    return handlerInfo;
  }

  /**
   * 이벤트 처리
   * @param {string} actionType - 액션 타입
   * @param {...any} args - 핸들러에 전달할 인자들
   * @returns {Promise<void>}
   * @throws {SlackNotificationError}
   */
  async handleEvent(actionType, ...args) {
    Logger.info(`이벤트 처리 시작: ${actionType}`);

    // 초기화되지 않았다면 초기화
    if (!this.isInitialized) {
      await this.preInitialize();
    }

    const handlerInfo = this.getHandlerInfo(actionType);

    if (!handlerInfo) {
      throw new SlackNotificationError(
        `알 수 없는 액션 타입: ${actionType}`,
        'UNKNOWN_ACTION_TYPE',
        { actionType, validTypes: Array.from(this.handlers.keys()) },
      );
    }

    const { handler, method } = handlerInfo;

    try {
      // 핸들러 메서드 실행
      await handler[method](...args);

      Logger.info(`이벤트 처리 완료: ${actionType}`);
    } catch (error) {
      Logger.error(`이벤트 처리 실패: ${actionType}`, error);

      // 에러를 상위로 전파
      if (error instanceof SlackNotificationError) {
        throw error;
      }

      // 일반 에러를 커스텀 에러로 변환
      throw new SlackNotificationError(
        `${actionType} 이벤트 처리 중 오류 발생`,
        'EVENT_PROCESSING_ERROR',
        {
          actionType,
          originalError: error.message,
          stack: error.stack,
        },
      );
    }
  }

  /**
   * 캐시 통계 조회
   * @returns {Object}
   */
  getCacheStats() {
    const stats = {
      isFactoryInitialized: this.isInitialized,
      handlers: {},
      services: this.serviceFactory.getCacheStats(),
    };

    // 각 핸들러의 캐시 통계
    this.handlers.forEach((handlerInfo, actionType) => {
      if (handlerInfo.handler.getCacheStats) {
        stats.handlers[actionType] = handlerInfo.handler.getCacheStats();
      }
    });

    return stats;
  }

  /**
   * 특정 액션 타입 지원 여부 확인
   * @param {string} actionType
   * @returns {boolean}
   */
  isSupported(actionType) {
    return this.handlers.has(actionType);
  }

  /**
   * 지원하는 모든 액션 타입 반환
   * @returns {string[]}
   */
  getSupportedActionTypes() {
    return Array.from(this.handlers.keys());
  }

  /**
   * 리소스 정리
   * @returns {Promise<void>}
   */
  async cleanup() {
    Logger.info('이벤트 핸들러 팩토리 정리 중...');

    // 각 핸들러 정리
    const uniqueHandlers = new Set(
      Array.from(this.handlers.values()).map((entry) => entry.handler),
    );

    await Promise.all(
      Array.from(uniqueHandlers).map((handler) => {
        if (handler.cleanup) {
          return handler.cleanup();
        }
        return Promise.resolve();
      }),
    );

    // 핸들러 맵 초기화
    this.handlers.clear();
    this.isInitialized = false;

    Logger.info('이벤트 핸들러 팩토리 정리 완료');
  }
}

module.exports = EventHandlerFactory;
