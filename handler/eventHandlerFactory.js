const CommentEventHandler = require('./commentEventHandler');
const ReviewEventHandler = require('./reviewEventHandler');
const DeploymentEventHandler = require('./deploymentEventHandler');
const { ACTION_TYPES } = require('../constants');
const Logger = require('../utils/logger');
const { SlackNotificationError } = require('../utils/errors');

/**
 * 이벤트 핸들러 팩토리
 * 액션 타입에 따라 적절한 핸들러를 생성하고 관리
 */
class EventHandlerFactory {
  /**
   * @param {import('../services/serviceFactory')} serviceFactory
   */
  constructor(serviceFactory) {
    this.serviceFactory = serviceFactory;
    this.services = serviceFactory.createServices();
    this.handlerRegistry = new Map();
    this.isInitialized = false;

    this.#registerEventHandlers();
  }

  /**
   * 액션 타입별 핸들러 등록
   * @private
   */
  #registerEventHandlers() {
    const commentHandler = new CommentEventHandler(this.services);
    const reviewHandler = new ReviewEventHandler(this.services);
    const deploymentHandler = new DeploymentEventHandler(this.services);

    // 액션 타입과 핸들러 메서드 매핑
    const handlerMappings = [
      [ACTION_TYPES.COMMENT, { handler: commentHandler, method: 'handle' }],
      [ACTION_TYPES.APPROVE, { handler: reviewHandler, method: 'handleApprovalEvent' }],
      [ACTION_TYPES.REVIEW_REQUESTED, { handler: reviewHandler, method: 'handleReviewRequestEvent' }],
      [ACTION_TYPES.CHANGES_REQUESTED, { handler: reviewHandler, method: 'handleReviewRequestEvent' }],
      [ACTION_TYPES.SCHEDULE, { handler: reviewHandler, method: 'handleScheduledReview' }],
      [ACTION_TYPES.DEPLOY, { handler: deploymentHandler, method: 'handleDeploy' }],
      [ACTION_TYPES.CI, { handler: deploymentHandler, method: 'handleBuild' }],
    ];

    handlerMappings.forEach(([actionType, handlerInfo]) => {
      this.handlerRegistry.set(actionType, handlerInfo);
    });

    Logger.debug(`${this.handlerRegistry.size}개의 이벤트 핸들러 등록됨`);
  }

  /**
   * 모든 핸들러 사전 초기화
   */
  async preInitialize() {
    if (this.isInitialized) return;

    try {
      Logger.info('이벤트 핸들러 사전 초기화 중...');
      Logger.time('핸들러 초기화');

      await this.#initializeUniqueHandlers();
      await this.serviceFactory.initializeAllServices();

      this.isInitialized = true;

      Logger.timeEnd('핸들러 초기화');
      Logger.info('모든 이벤트 핸들러 사전 초기화 완료');
    } catch (error) {
      Logger.error('이벤트 핸들러 사전 초기화 실패', error);
      // 초기화 실패해도 개별 핸들러는 동작 가능
    }
  }

  /**
   * 중복되지 않는 핸들러들만 초기화
   * @private
   */
  async #initializeUniqueHandlers() {
    const uniqueHandlers = this.#getUniqueHandlers();

    await Promise.all(
      Array.from(uniqueHandlers).map((handler) => handler.initialize()),
    );
  }

  /**
   * 중복되지 않는 핸들러 인스턴스들 추출
   * @private
   * @returns {Set}
   */
  #getUniqueHandlers() {
    const uniqueHandlers = new Set();

    this.handlerRegistry.forEach(({ handler }) => {
      uniqueHandlers.add(handler);
    });

    return uniqueHandlers;
  }

  /**
   * 이벤트 처리
   * @param {string} actionType
   * @param {...any} args
   * @returns {Promise<void>}
   */
  async handleEvent(actionType, ...args) {
    Logger.info(`이벤트 처리 시작: ${actionType}`);

    if (!this.isInitialized) {
      await this.preInitialize();
    }

    const handlerInfo = this.#getHandlerInfo(actionType);
    if (!handlerInfo) {
      this.#throwUnknownActionTypeError(actionType);
    }

    try {
      await EventHandlerFactory.#executeHandler(handlerInfo, actionType, args);
      Logger.info(`이벤트 처리 완료: ${actionType}`);
    } catch (error) {
      EventHandlerFactory.#handleEventProcessingError(error, actionType);
    }
  }

  /**
   * 핸들러 정보 조회
   * @private
   * @param {string} actionType
   * @returns {Object|null}
   */
  #getHandlerInfo(actionType) {
    const handlerInfo = this.handlerRegistry.get(actionType);

    if (!handlerInfo) {
      Logger.error(`등록되지 않은 액션 타입: ${actionType}`);
      return null;
    }

    return handlerInfo;
  }

  /**
   * 핸들러 실행
   * @private
   * @param {Object} handlerInfo
   * @param {string} actionType
   * @param {Array} args
   */
  static async #executeHandler(handlerInfo, actionType, args) {
    const { handler, method } = handlerInfo;
    await handler[method](...args);
  }

  /**
   * 알 수 없는 액션 타입 에러 발생
   * @private
   * @param {string} actionType
   * @throws {SlackNotificationError}
   */
  #throwUnknownActionTypeError(actionType) {
    throw new SlackNotificationError(
      `알 수 없는 액션 타입: ${actionType}`,
      'UNKNOWN_ACTION_TYPE',
      {
        actionType,
        supportedTypes: Array.from(this.handlerRegistry.keys()),
      },
    );
  }

  /**
   * 이벤트 처리 에러 핸들링
   * @private
   * @param {Error} error
   * @param {string} actionType
   * @throws {SlackNotificationError}
   */
  static #handleEventProcessingError(error, actionType) {
    Logger.error(`이벤트 처리 실패: ${actionType}`, error);

    if (error instanceof SlackNotificationError) {
      throw error;
    }

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

  /**
   * 액션 타입 지원 여부 확인
   * @param {string} actionType
   * @returns {boolean}
   */
  isActionTypeSupported(actionType) {
    return this.handlerRegistry.has(actionType);
  }

  /**
   * 지원하는 모든 액션 타입 조회
   * @returns {string[]}
   */
  getSupportedActionTypes() {
    return Array.from(this.handlerRegistry.keys());
  }

  /**
   * 캐시 통계 조회
   * @returns {Object}
   */
  getCacheStats() {
    const stats = {
      isFactoryInitialized: this.isInitialized,
      registeredHandlers: this.handlerRegistry.size,
      services: this.serviceFactory.getCacheStats(),
    };

    // 각 핸들러의 캐시 통계 (중복 제거)
    const uniqueHandlers = this.#getUniqueHandlers();
    stats.handlers = {};

    uniqueHandlers.forEach((handler) => {
      if (handler.getCacheStats) {
        stats.handlers[handler.constructor.name] = handler.getCacheStats();
      }
    });

    return stats;
  }

  /**
   * 리소스 정리
   */
  async cleanup() {
    Logger.info('이벤트 핸들러 팩토리 정리 중...');

    const uniqueHandlers = this.#getUniqueHandlers();

    await Promise.all(
      Array.from(uniqueHandlers).map((handler) => {
        if (handler.cleanup) {
          return handler.cleanup();
        }
        return Promise.resolve();
      }),
    );

    this.handlerRegistry.clear();
    this.isInitialized = false;

    Logger.info('이벤트 핸들러 팩토리 정리 완료');
  }
}

module.exports = EventHandlerFactory;
