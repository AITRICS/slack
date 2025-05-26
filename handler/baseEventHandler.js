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
 * 이벤트 핸들러 기본 클래스
 */
class BaseEventHandler {
  /**
   * @param {EventHandlerServices} services - 주입된 서비스들
   */
  constructor(services) {
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

    this.gitHubApiHelper = services.gitHubApiHelper;
    this.slackUserService = services.slackUserService;
    this.slackChannelService = services.slackChannelService;
    this.slackMessageService = services.slackMessageService;
    this.initialized = false;
  }

  /**
   * 핸들러 초기화 (필요시 오버라이드)
   * @protected
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    Logger.debug(`${this.constructor.name} 초기화 중...`);
    this.initialized = true;
    Logger.debug(`${this.constructor.name} 초기화 완료`);
  }

  /**
   * 페이로드 검증
   * @protected
   * @param {Object} payload - GitHub webhook 페이로드
   * @throws {PayloadValidationError} 페이로드가 유효하지 않은 경우
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
   * @param {Object} repository - GitHub repository 객체
   * @returns {{name: string, fullName: string, url: string}} 저장소 정보
   */
  static extractRepoData(repository) {
    return {
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
    };
  }
}

module.exports = BaseEventHandler;
