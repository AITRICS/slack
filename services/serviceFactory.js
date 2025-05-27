const { WebClient } = require('@slack/web-api');
const { Octokit } = require('@octokit/rest');
const { retry } = require('@octokit/plugin-retry');
const { paginateRest } = require('@octokit/plugin-paginate-rest');
const GitHubApiHelper = require('../github/gitHubApiHelper');
const SlackUserService = require('../slack/slackUserService');
const SlackChannelService = require('../slack/slackChannelService');
const SlackMessageService = require('../slack/slackMessageService');
const environment = require('../config/environment');
const { API_CONFIG } = require('../constants');
const Logger = require('../utils/logger');
const EnhancedOctokit = Octokit.plugin(retry, paginateRest);

/**
 * 서비스 팩토리 클래스 (싱글톤 패턴)
 * 모든 서비스 인스턴스를 생성하고 관리
 */
class ServiceFactory {
  static #instance = null;

  #services = null;

  #webClient = null;

  #octokit = null;

  /**
   * WebClient getter
   * @returns {import('@slack/web-api').WebClient}
   */
  get webClient() {
    if (!this.#webClient) {
      this.#createApiClients();
    }
    return this.#webClient;
  }

  /**
   * Octokit getter
   * @returns {import('@octokit/plugin-paginate-rest').PaginateInterface
   *          & import('@octokit/rest').RestEndpointMethods
   *          & import('@octokit/rest').Api
   *          & import('@octokit/rest').Octokit}
   */
  get octokit() {
    if (!this.#octokit) {
      this.#createApiClients();
    }

    if (!this.#octokit) {
      throw new Error('Octokit initialization failed');
    }

    return this.#octokit;
  }

  /**
   * 모든 서비스 생성
   * @returns {Object} 서비스 객체들
   */
  createServices() {
    if (this.#services) {
      return this.#services;
    }

    Logger.info('서비스 생성 중...');

    try {
      const gitHubApiHelper = new GitHubApiHelper(this.octokit);
      const slackUserService = new SlackUserService(this.webClient, gitHubApiHelper);
      const slackChannelService = new SlackChannelService(gitHubApiHelper);
      const slackMessageService = new SlackMessageService(this.webClient);

      this.#services = {
        gitHubApiHelper,
        slackUserService,
        slackChannelService,
        slackMessageService,
      };

      Logger.info('모든 서비스 생성 완료');
      return this.#services;
    } catch (error) {
      Logger.error('서비스 생성 실패', error);
      throw error;
    }
  }

  /**
   * API 클라이언트 생성
   * @private
   * @throws {Error} 서비스 생성 실패 시
   */
  #createApiClients() {
    if (this.#webClient && this.#octokit) {
      return;
    }

    try {
      const config = environment.load();

      this.#webClient = new WebClient(config.slack.token, {
        retryConfig: {
          retries: config.features.maxRetries || API_CONFIG.MAX_RETRIES,
          factor: 2,
          minTimeout: config.features.retryDelay || API_CONFIG.RETRY_DELAY_MS,
        },
        timeout: API_CONFIG.REQUEST_TIMEOUT_MS,
      });

      this.#octokit = new EnhancedOctokit({
        auth: config.github.token,
        userAgent: 'slack-notification-action/1.0',
        timeZone: config.runtime.timezone,
        baseUrl: 'https://api.github.com',
        request: {
          timeout: API_CONFIG.REQUEST_TIMEOUT_MS,
          retry: {
            maxRetries: config.features.maxRetries ?? API_CONFIG.MAX_RETRIES,
            retryAfterBaseValue: config.features.retryDelay ?? API_CONFIG.RETRY_DELAY_MS,
          },
        },
      });

      Logger.debug('API 클라이언트 생성 완료');
    } catch (error) {
      Logger.error('API 클라이언트 생성 실패', error);
      throw error;
    }
  }

  /**
   * 서비스 정리 (테스트용)
   */
  cleanup() {
    this.#services = null;
    this.#webClient = null;
    this.#octokit = null;
    Logger.debug('서비스 팩토리 정리 완료');
  }

  /**
   * 싱글톤 인스턴스 반환
   * @static
   * @returns {ServiceFactory}
   */
  static getInstance() {
    if (!ServiceFactory.#instance) {
      ServiceFactory.#instance = new ServiceFactory();
    }
    return ServiceFactory.#instance;
  }

  /**
   * 싱글톤 인스턴스 재설정 (테스트용)
   * @static
   */
  static resetInstance() {
    if (ServiceFactory.#instance) {
      ServiceFactory.#instance.cleanup();
      ServiceFactory.#instance = null;
    }
  }
}

module.exports = ServiceFactory;
