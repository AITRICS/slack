const { ACTION_TYPES } = require('@/constants');
const Logger = require('@/utils/logger');
const { SlackNotificationError } = require('@/utils/errors');
const CommentEventHandler = require('./commentEventHandler');
const ReviewEventHandler = require('./reviewEventHandler');
const DeploymentEventHandler = require('./deploymentEventHandler');

/**
 * 이벤트 핸들러 팩토리
 * 액션 타입에 따라 적절한 핸들러를 선택하고 실행
 */
class EventHandlerFactory {
  /**
   * 이벤트 핸들러 팩토리
   * @param {import('../services/serviceFactory')} serviceFactory - 서비스 팩토리
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
    this.handlerRegistry.set(ACTION_TYPES.COMMENT, { handler: commentHandler, method: 'handleCommentEvent' });
    this.handlerRegistry.set(ACTION_TYPES.APPROVE, { handler: reviewHandler, method: 'handleApprovalEvent' });
    this.handlerRegistry.set(ACTION_TYPES.REVIEW_REQUESTED, { handler: reviewHandler, method: 'handleReviewRequestEvent' });
    this.handlerRegistry.set(ACTION_TYPES.CHANGES_REQUESTED, { handler: reviewHandler, method: 'handleReviewRequestEvent' });
    this.handlerRegistry.set(ACTION_TYPES.SCHEDULE, { handler: reviewHandler, method: 'handleScheduledReview' });
    this.handlerRegistry.set(ACTION_TYPES.DEPLOY, { handler: deploymentHandler, method: 'handleDeploy' });
    this.handlerRegistry.set(ACTION_TYPES.CI, { handler: deploymentHandler, method: 'handleBuild' });

    Logger.debug(`${this.handlerRegistry.size}개의 이벤트 핸들러 등록됨`);
  }

  /**
   * 이벤트 처리 (코멘트)
   * @param {'comment'} actionType - 코멘트 액션 타입
   * @param {CommentPayload} payload - 코멘트 페이로드
   * @returns {Promise<void>}
   */

  /**
   * 이벤트 처리 (승인)
   * @param {'approve'} actionType - 승인 액션 타입
   * @param {ReviewPayload} payload - 리뷰 페이로드
   * @returns {Promise<void>}
   */

  /**
   * 이벤트 처리 (리뷰 요청)
   * @param {'review_requested'|'changes_requested'} actionType - 리뷰 요청 액션 타입
   * @param {ReviewPayload} payload - 리뷰 페이로드
   * @returns {Promise<void>}
   */

  /**
   * 이벤트 처리 (예약된 리뷰)
   * @param {'schedule'} actionType - 스케줄 액션 타입
   * @param {Object} payload - 저장소 페이로드
   * @param {GitHubRepository} payload.repository - 저장소 정보
   * @returns {Promise<void>}
   */

  /**
   * 이벤트 처리 (배포)
   * @param {'deploy'} actionType - 배포 액션 타입
   * @param {GitHubContext} context - GitHub context
   * @param {string} ec2Name - EC2 인스턴스 이름
   * @param {string} imageTag - 이미지 태그
   * @param {string} jobStatus - 작업 상태
   * @returns {Promise<void>}
   */

  /**
   * 이벤트 처리 (CI/빌드)
   * @param {'ci'} actionType - CI 액션 타입
   * @param {GitHubContext} context - GitHub context
   * @param {string} branchName - 브랜치 이름
   * @param {string} imageTag - 이미지 태그
   * @param {string} jobName - 작업 이름들 (쉼표로 구분)
   * @param {string} jobStatus - 작업 상태
   * @returns {Promise<void>}
   */

  /**
   * 이벤트 처리 (통합)
   * @param {ActionType} actionType - 액션 타입
   * @param {...any} args - 핸들러에 전달할 인수들
   * @returns {Promise<void>}
   * @throws {SlackNotificationError} 알 수 없는 액션 타입이거나 처리 실패 시
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
