const Logger = require('../utils/logger');
const { findSlackUserProperty } = require('../utils/nameUtils');

/**
 * Service for managing Slack user operations
 */
class SlackUserService {
  /**
   * @param {import('@slack/web-api').WebClient} webClient
   * @param {import('../github/gitHubApiHelper')} gitHubApiHelper
   */
  constructor(webClient, gitHubApiHelper) {
    this.webClient = webClient;
    this.gitHubApiHelper = gitHubApiHelper;
    this.cachedUsers = null;
  }

  /**
   * Fetches Slack users with caching
   * @returns {Promise<Array>} Array of Slack users
   */
  async getSlackUsers() {
    if (this.cachedUsers) {
      return this.cachedUsers;
    }

    try {
      const { members } = await this.webClient.users.list();
      this.cachedUsers = members;
      return members;
    } catch (error) {
      Logger.error('Failed to fetch Slack users', error);
      throw new Error('Failed to fetch Slack users');
    }
  }

  /**
   * Gets a Slack user property by GitHub username
   * @param {string} githubUsername
   * @param {'id'|'realName'} property
   * @returns {Promise<string>}
   */
  async getSlackUserPropertyByGithubUsername(githubUsername, property) {
    if (!githubUsername) {
      Logger.error('Invalid GitHub username provided');
      return githubUsername;
    }

    try {
      const slackUsers = await this.getSlackUsers();
      const githubUserRealName = await this.gitHubApiHelper.fetchUserRealName(githubUsername);
      return findSlackUserProperty(slackUsers, githubUserRealName, property);
    } catch (error) {
      Logger.error(`Failed to get Slack user property for ${githubUsername}`, error);
      return githubUsername;
    }
  }

  /**
   * Clears the cached users
   */
  clearCache() {
    this.cachedUsers = null;
  }
}

module.exports = SlackUserService;
