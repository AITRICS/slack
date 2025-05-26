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
  static #instance = null;

  #services = null;

  #webClient = null;

  #octokit = null;

  /**
   * 모든 서비스 초기화 및 반환
   * @returns {Object} 서비스 객체들
   */
  createServices() {
    if (this.#services) {
      return this.#services;
    }

    Logger.info('서비스 초기화 중...');
    this.#createApiClients();

    const gitHubApiHelper = new GitHubApiHelper(this.#octokit);
    const slackUserService = new SlackUserService(this.#webClient, gitHubApiHelper);
    const slackChannelService = new SlackChannelService(gitHubApiHelper);
    const slackMessageService = new SlackMessageService(this.#webClient);

    this.#services = {
      gitHubApiHelper,
      slackUserService,
      slackChannelService,
      slackMessageService,
    };

    Logger.info('모든 서비스 초기화 완료');
    return this.#services;
  }

  /**
   * API 클라이언트 생성
   * @private
   */
  #createApiClients() {
    const config = environment.load();

    this.#webClient = new WebClient(config.slack.token, {
      retryConfig: {
        retries: config.features.maxRetries,
        factor: 2,
        minTimeout: config.features.retryDelay,
      },
    });

    this.#octokit = new Octokit({
      auth: config.github.token,
      userAgent: 'slack-notification-action/1.0',
      timeZone: config.runtime.timezone,
      baseUrl: 'https://api.github.com',
      request: {
        timeout: 30000,
      },
    });

    Logger.debug('API 클라이언트 생성 완료');
  }

  /**
   * WebClient 인스턴스 반환
   * @returns {WebClient}
   */
  getWebClient() {
    if (!this.#webClient) {
      this.#createApiClients();
    }
    return this.#webClient;
  }

  /**
   * Octokit 인스턴스 반환
   * @returns {Octokit}
   */
  getOctokit() {
    if (!this.#octokit) {
      this.#createApiClients();
    }
    return this.#octokit;
  }

  /**
   * 특정 서비스만 가져오기
   * @param {string} serviceName
   * @returns {Object|null}
   */
  getService(serviceName) {
    const services = this.createServices();
    return services[serviceName] || null;
  }

  /**
   * 모든 서비스 초기화 (캐시 프리로드 등)
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
    }
  }

  /**
   * 캐시 통계 조회
   * @returns {Object}
   */
  getCacheStats() {
    if (!this.#services) {
      return { initialized: false };
    }

    return {
      initialized: true,
      slackUserService: this.#services.slackUserService.getCacheStats(),
      slackChannelService: this.#services.slackChannelService.getCacheStats(),
    };
  }

  /**
   * 모든 캐시 초기화
   */
  clearAllCaches() {
    if (!this.#services) return;

    this.#services.slackUserService.clearCache();
    this.#services.slackChannelService.clearCache();

    Logger.info('모든 서비스 캐시 초기화됨');
  }

  /**
   * 리소스 정리
   */
  cleanup() {
    this.clearAllCaches();
    this.#services = null;
    this.#webClient = null;
    this.#octokit = null;

    Logger.info('서비스 팩토리 리소스 정리 완료');
  }

  /**
   * 싱글톤 인스턴스 반환
   * @returns {ServiceFactory}
   */
  static getInstance() {
    if (!ServiceFactory.#instance) {
      ServiceFactory.#instance = new ServiceFactory();
    }
    return ServiceFactory.#instance;
  }
}

module.exports = ServiceFactory;
