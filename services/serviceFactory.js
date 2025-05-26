const { WebClient } = require('@slack/web-api');
const { Octokit } = require('@octokit/rest');
const GitHubApiHelper = require('../github/gitHubApiHelper');
const SlackUserService = require('../slack/slackUserService');
const SlackChannelService = require('../slack/slackChannelService');
const SlackMessageService = require('../slack/slackMessageService');
const environment = require('../config/environment');
const Logger = require('../utils/logger');

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
   * @returns {import('@octokit/rest').Octokit}
   */
  get octokit() {
    if (!this.#octokit) {
      this.#createApiClients();
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
  }

  /**
   * API 클라이언트 생성
   * @private
   */
  #createApiClients() {
    if (this.#webClient && this.#octokit) {
      return;
    }

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
