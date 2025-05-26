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
    BaseEventHandler.#validateServices(services);

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
  static #validateServices(services) {
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
   * 페이로드 검증
   * @protected
   * @param {Object} payload
   * @throws {PayloadValidationError}
   */
  static validatePayload(payload) {
    if (!payload) {
      throw new PayloadValidationError('페이로드가 없습니다');
    }

    if (!payload.repository) {
      throw new PayloadValidationError('repository 정보가 없습니다', payload);
    }
  }

  /**
   * 저장소 정보 추출
   * @protected
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
