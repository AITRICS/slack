const CommentEventHandler = require('./commentEventHandler');
const ReviewEventHandler = require('./reviewEventHandler');
const DeploymentEventHandler = require('./deploymentEventHandler');
const { ACTION_TYPES } = require('../constants');
const Logger = require('../utils/logger');
const { SlackNotificationError } = require('../utils/errors');

/**
 * 이벤트 핸들러 팩토리
 * 액션 타입에 따라 적절한 핸들러를 선택하고 실행
 */
class EventHandlerFactory {
  /**
   * @param {import('../services/serviceFactory')} serviceFactory
   */
  constructor(serviceFactory) {
    this.services = serviceFactory.createServices();
    this.handlerRegistry = new Map();

    this.#registerEventHandlers();
  }

  /**
   * 액션 타입별 핸들러 등록
   * @private
   */
  #registerEventHandlers() {
    // 모든 핸들러가 동일한 서비스 인스턴스를 공유
    if (!this.services) {
      throw new Error('Service가 초기화 되지 않았습니다. (createServices)');
    }

    const commentHandler = new CommentEventHandler(this.services);
    const reviewHandler = new ReviewEventHandler(this.services);
    const deploymentHandler = new DeploymentEventHandler(this.services);

    // 액션 타입과 핸들러 메서드 매핑
    this.handlerRegistry.set(ACTION_TYPES.COMMENT, { handler: commentHandler, method: 'handle' });
    this.handlerRegistry.set(ACTION_TYPES.APPROVE, { handler: reviewHandler, method: 'handleApprovalEvent' });
    this.handlerRegistry.set(ACTION_TYPES.REVIEW_REQUESTED, { handler: reviewHandler, method: 'handleReviewRequestEvent' });
    this.handlerRegistry.set(ACTION_TYPES.CHANGES_REQUESTED, { handler: reviewHandler, method: 'handleReviewRequestEvent' });
    this.handlerRegistry.set(ACTION_TYPES.SCHEDULE, { handler: reviewHandler, method: 'handleScheduledReview' });
    this.handlerRegistry.set(ACTION_TYPES.DEPLOY, { handler: deploymentHandler, method: 'handleDeploy' });
    this.handlerRegistry.set(ACTION_TYPES.CI, { handler: deploymentHandler, method: 'handleBuild' });

    Logger.debug(`${this.handlerRegistry.size}개의 이벤트 핸들러 등록됨`);
  }

  /**
   * 이벤트 처리
   * @param {string} actionType - 액션 타입
   * @param {...any} args - 핸들러에 전달할 인수들
   * @returns {Promise<void>}
   */
  async handleEvent(actionType, ...args) {
    Logger.info(`이벤트 처리 시작: ${actionType}`);

    const handlerInfo = this.handlerRegistry.get(actionType);
    if (!handlerInfo) {
      throw new SlackNotificationError(
        `알 수 없는 액션 타입: ${actionType}`,
        'UNKNOWN_ACTION_TYPE',
        {
          actionType,
          supportedTypes: Array.from(this.handlerRegistry.keys()),
        },
      );
    }

    try {
      const { handler, method } = handlerInfo;
      await handler[method](...args);
      Logger.info(`이벤트 처리 완료: ${actionType}`);
    } catch (error) {
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
  }
}

module.exports = EventHandlerFactory;
