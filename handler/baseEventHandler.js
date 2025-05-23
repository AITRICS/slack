const SlackUserService = require('../slack/slackUserService');
const SlackChannelService = require('../slack/slackChannelService');
const SlackMessageService = require('../slack/slackMessageService');
const GitHubApiHelper = require('../github/gitHubApiHelper');
const Logger = require('../utils/logger');

/**
 * Base class for event handlers
 */
class BaseEventHandler {
  /**
   * @param {import('@octokit/rest').Octokit} octokit
   * @param {import('@slack/web-api').WebClient} webClient
   */
  constructor(octokit, webClient) {
    this.gitHubApiHelper = new GitHubApiHelper(octokit);
    this.slackUserService = new SlackUserService(webClient, this.gitHubApiHelper);
    this.slackChannelService = new SlackChannelService(this.gitHubApiHelper);
    this.slackMessageService = new SlackMessageService(webClient);
  }

  /**
   * Template method for handling events
   * @param {Object} payload
   * @returns {Promise<void>}
   */
  async handle(payload) {
    try {
      await this.validatePayload(payload);
      await this.processEvent(payload);
    } catch (error) {
      Logger.error(`Error handling ${this.constructor.name} event`, error);
      throw error;
    }
  }

  /**
   * Validates the payload - to be implemented by subclasses
   * @param {Object} payload
   * @throws {Error}
   */
  async validatePayload(payload) {
    if (!payload) {
      throw new Error('Invalid payload');
    }
  }

  /**
   * Processes the event - to be implemented by subclasses
   * @param {Object} payload
   * @returns {Promise<void>}
   */
  async processEvent(payload) {
    throw new Error('processEvent must be implemented by subclass');
  }

  /**
   * Extracts repository data from payload
   * @param {Object} repository
   * @returns {Object}
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
