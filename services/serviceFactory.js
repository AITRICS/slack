const { WebClient } = require('@slack/web-api');
const { Octokit } = require('@octokit/rest');
const GitHubApiHelper = require('../github/gitHubApiHelper');
const SlackUserService = require('../slack/slackUserService');
const SlackChannelService = require('../slack/slackChannelService');
const SlackMessageService = require('../slack/slackMessageService');
const environment = require('../config/environment');
const Logger = require('../utils/logger');

/**
 * 서비스 팩토리 클래스
 * 의존성 주입을 위한 모든 서비스 인스턴스를 생성하고 관리
 */
class ServiceFactory {
  constructor() {
    this._services = null;
    this._webClient = null;
    this._octokit = null;
  }

  /**
   * 모든 서비스 초기화 및 반환
   * @returns {{gitHubApiHelper: GitHubApiHelper, slackUserService: SlackUserService, slackChannelService: SlackChannelService, slackMessageService: SlackMessageService}}
   */
  createServices() {
    if (this._services) {
      return this._services;
    }

    Logger.info('서비스 초기화 중...');

    // 클라이언트 생성
    this._createClients();

    // 서비스 생성
    const gitHubApiHelper = new GitHubApiHelper(this._octokit);
    const slackUserService = new SlackUserService(this._webClient, gitHubApiHelper);
    const slackChannelService = new SlackChannelService(gitHubApiHelper);
    const slackMessageService = new SlackMessageService(this._webClient);

    this._services = {
      gitHubApiHelper,
      slackUserService,
      slackChannelService,
      slackMessageService,
    };

    Logger.info('모든 서비스 초기화 완료');
    return this._services;
  }

  /**
   * API 클라이언트 생성
   * @private
   */
  _createClients() {
    const config = environment.load();

    // Slack 클라이언트
    this._webClient = new WebClient(config.slack.token, {
      retryConfig: {
        retries: config.features.maxRetries,
        factor: 2,
        minTimeout: config.features.retryDelay,
      },
    });

    // GitHub 클라이언트
    this._octokit = new Octokit({
      auth: config.github.token,
      userAgent: 'slack-notification-action/1.0',
      timeZone: config.runtime.timezone,
      baseUrl: 'https://api.github.com',
      request: {
        timeout: 30000, // 30초
      },
    });

    Logger.debug('API 클라이언트 생성 완료');
  }

  /**
   * WebClient 인스턴스 반환 (단독 사용이 필요한 경우)
   * @returns {WebClient}
   */
  getWebClient() {
    if (!this._webClient) {
      this._createClients();
    }
    return this._webClient;
  }

  /**
   * Octokit 인스턴스 반환 (단독 사용이 필요한 경우)
   * @returns {Octokit}
   */
  getOctokit() {
    if (!this._octokit) {
      this._createClients();
    }
    return this._octokit;
  }

  /**
   * 특정 서비스만 가져오기
   * @param {string} serviceName - 서비스 이름
   * @returns {Object|null}
   */
  getService(serviceName) {
    const services = this.createServices();
    return services[serviceName] || null;
  }

  /**
   * 모든 서비스 초기화 (캐시 프리로드 등)
   * @returns {Promise<void>}
   */
  async initializeAllServices() {
    const services = this.createServices();

    try {
      await Promise.all([
        services.slackUserService.initialize(),
        services.slackChannelService.preloadTeamMemberships(),
      ]);

      Logger.info('모든 서비스 사전 초기화 완료');
    } catch (error) {
      Logger.error('서비스 사전 초기화 중 오류 발생', error);
      // 실패해도 계속 진행
    }
  }

  /**
   * 캐시 통계 조회
   * @returns {Object}
   */
  getCacheStats() {
    if (!this._services) {
      return { initialized: false };
    }

    return {
      initialized: true,
      slackUserService: this._services.slackUserService.getCacheStats(),
      slackChannelService: this._services.slackChannelService.getCacheStats(),
    };
  }

  /**
   * 모든 캐시 초기화
   */
  clearAllCaches() {
    if (!this._services) return;

    this._services.slackUserService.clearCache();
    this._services.slackChannelService.clearCache();

    Logger.info('모든 서비스 캐시 초기화됨');
  }

  /**
   * 리소스 정리
   */
  cleanup() {
    this.clearAllCaches();
    this._services = null;
    this._webClient = null;
    this._octokit = null;

    Logger.info('서비스 팩토리 리소스 정리 완료');
  }

  /**
   * 싱글톤 인스턴스 반환
   * @returns {ServiceFactory}
   */
  static getInstance() {
    if (!ServiceFactory._instance) {
      ServiceFactory._instance = new ServiceFactory();
    }
    return ServiceFactory._instance;
  }
}

// 싱글톤 인스턴스
ServiceFactory._instance = null;

module.exports = ServiceFactory;
