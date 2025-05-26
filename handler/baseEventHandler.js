const Logger = require('../utils/logger');
const { PayloadValidationError } = require('../utils/errors');

/**
 * @typedef {Object} EventHandlerServices
 * @property {import('../github/gitHubApiHelper')} gitHubApiHelper
 * @property {import('../slack/slackUserService')} slackUserService
 * @property {import('../slack/slackChannelService')} slackChannelService
 * @property {import('../slack/slackMessageService')} slackMessageService
 */

/**
 * 이벤트 핸들러 기본 클래스 (의존성 주입 패턴 적용)
 */
class BaseEventHandler {
  /**
   * @param {EventHandlerServices} services - 주입된 서비스들
   */
  constructor(services) {
    this.validateServices(services);

    this.gitHubApiHelper = services.gitHubApiHelper;
    this.slackUserService = services.slackUserService;
    this.slackChannelService = services.slackChannelService;
    this.slackMessageService = services.slackMessageService;
    this.isInitialized = false;
  }

  /**
   * 서비스 검증
   * @private
   * @param {EventHandlerServices} services
   * @throws {Error} 필수 서비스가 누락된 경우
   */
  validateServices(services) {
    const required = [
      'gitHubApiHelper',
      'slackUserService',
      'slackChannelService',
      'slackMessageService',
    ];

    const missing = required.filter((service) => !services[service]);

    if (missing.length > 0) {
      throw new Error(`필수 서비스가 누락되었습니다: ${missing.join(', ')}`);
    }
  }

  /**
   * 핸들러 초기화
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      Logger.info(`${this.constructor.name} 초기화 중...`);

      // 서비스들 초기화 (병렬 처리)
      await Promise.all([
        this.slackUserService.initialize(),
        this.slackChannelService.preloadTeamMemberships(),
      ]);

      this.isInitialized = true;
      Logger.info(`${this.constructor.name} 초기화 완료`);
    } catch (error) {
      Logger.error(`${this.constructor.name} 초기화 실패`, error);
      // 초기화 실패해도 폴백 모드로 동작 가능하도록 에러를 던지지 않음
    }
  }

  /**
   * 이벤트 처리 템플릿 메서드
   * @param {Object} payload - 이벤트 페이로드
   * @returns {Promise<void>}
   */
  async handle(payload) {
    const startTime = Date.now();
    const handlerName = this.constructor.name;

    try {
      Logger.info(`${handlerName} 이벤트 처리 시작`);
      Logger.debug('페이로드:', payload);

      // 초기화
      await this.initialize();

      // 페이로드 검증
      await this.validatePayload(payload);

      // 이벤트 처리
      await this.processEvent(payload);

      const duration = Date.now() - startTime;
      Logger.info(`${handlerName} 이벤트 처리 완료 (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      Logger.error(`${handlerName} 이벤트 처리 실패 (${duration}ms)`, error);
      throw error;
    }
  }

  /**
   * 페이로드 검증 - 서브클래스에서 구현
   * @param {Object} payload
   * @throws {PayloadValidationError}
   */
  async validatePayload(payload) {
    if (!payload) {
      throw new PayloadValidationError('페이로드가 없습니다');
    }

    if (!payload.repository) {
      throw new PayloadValidationError('repository 정보가 없습니다', payload);
    }
  }

  /**
   * 이벤트 처리 - 서브클래스에서 구현
   * @param {Object} payload
   * @returns {Promise<void>}
   */
  async processEvent(payload) {
    throw new Error('processEvent는 서브클래스에서 구현해야 합니다');
  }

  /**
   * 저장소 정보 추출
   * @param {Object} repository
   * @returns {{name: string, fullName: string, url: string}}
   */
  static extractRepoData(repository) {
    return {
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
    };
  }

  /**
   * 재시도 로직
   * @protected
   * @param {Function} operation - 실행할 작업
   * @param {Object} options - 재시도 옵션
   * @returns {Promise<any>}
   */
  async retry(operation, options = {}) {
    const {
      maxRetries = 3,
      delay = 1000,
      backoff = 2,
      retryCondition = () => true,
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries || !retryCondition(error)) {
          throw error;
        }

        const waitTime = delay * backoff ** (attempt - 1);
        Logger.warn(`재시도 ${attempt}/${maxRetries} (${waitTime}ms 대기)`, error.message);

        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    throw lastError;
  }

  /**
   * 캐시 통계 조회
   * @returns {Object}
   */
  getCacheStats() {
    return {
      isInitialized: this.isInitialized,
      slackUserCache: this.slackUserService.getCacheStats(),
      slackChannelCache: this.slackChannelService.getCacheStats(),
    };
  }

  /**
   * 리소스 정리
   * @returns {Promise<void>}
   */
  async cleanup() {
    Logger.debug(`${this.constructor.name} 리소스 정리`);
    // 필요시 서브클래스에서 오버라이드
  }
}

module.exports = BaseEventHandler;
