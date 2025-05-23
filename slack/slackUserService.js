const Logger = require('../utils/logger');
const { findSlackUserProperty } = require('../utils/nameUtils');

/**
 * Service for managing Slack user operations with optimized caching
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
    this.githubToSlackMap = new Map(); // GitHub username -> Slack info cache
    this.isInitialized = false;
  }

  /**
   * Initializes the service by pre-loading Slack users
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      Logger.info('Initializing Slack user cache...');
      await this.getSlackUsers();
      this.isInitialized = true;
      Logger.info('Slack user cache initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize Slack user cache', error);
      // Don't throw error, allow fallback to individual calls
    }
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
      Logger.info(`Cached ${members.length} Slack users`);
      return members;
    } catch (error) {
      Logger.error('Failed to fetch Slack users', error);
      throw new Error('Failed to fetch Slack users');
    }
  }

  /**
   * Gets Slack user properties for multiple GitHub usernames in batch
   * @param {Array<string>} githubUsernames - Array of GitHub usernames
   * @param {'id'|'realName'} property - Property to retrieve
   * @returns {Promise<Map<string, string>>} Map of GitHub username to Slack property
   */
  async getSlackUserPropertiesBatch(githubUsernames, property) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const result = new Map();
    const uncachedUsernames = [];

    // Check cache first
    githubUsernames.forEach((username) => {
      const cacheKey = `${username}:${property}`;
      if (this.githubToSlackMap.has(cacheKey)) {
        result.set(username, this.githubToSlackMap.get(cacheKey));
      } else {
        uncachedUsernames.push(username);
      }
    });

    if (uncachedUsernames.length === 0) {
      return result;
    }

    try {
      const slackUsers = await this.getSlackUsers();

      // Batch process uncached usernames
      await Promise.all(
        uncachedUsernames.map(async (githubUsername) => {
          try {
            const githubUserRealName = await this.gitHubApiHelper.fetchUserRealName(githubUsername);
            const slackProperty = findSlackUserProperty(slackUsers, githubUserRealName, property);

            // Cache the result
            const cacheKey = `${githubUsername}:${property}`;
            this.githubToSlackMap.set(cacheKey, slackProperty);
            result.set(githubUsername, slackProperty);
          } catch (error) {
            Logger.error(`Failed to get Slack property for ${githubUsername}`, error);
            result.set(githubUsername, githubUsername); // Fallback to username
          }
        }),
      );
    } catch (error) {
      Logger.error('Failed to process batch Slack user properties', error);
      // Fallback: return usernames as-is for uncached entries
      uncachedUsernames.forEach((username) => {
        result.set(username, username);
      });
    }

    return result;
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

    const result = await this.getSlackUserPropertiesBatch([githubUsername], property);
    return result.get(githubUsername) || githubUsername;
  }

  /**
   * Optimized method to get Slack IDs for multiple GitHub usernames
   * @param {Array<{githubUsername: string}>} recipients
   * @returns {Promise<Array<{githubUsername: string, slackId: string}>>}
   */
  async enrichRecipientsWithSlackIds(recipients) {
    const githubUsernames = recipients.map((r) => r.githubUsername);
    const slackIdMap = await this.getSlackUserPropertiesBatch(githubUsernames, 'id');

    return recipients.map((recipient) => ({
      ...recipient,
      slackId: slackIdMap.get(recipient.githubUsername) || recipient.githubUsername,
    }));
  }

  /**
   * Clears the cached users and GitHub-to-Slack mapping
   */
  clearCache() {
    this.cachedUsers = null;
    this.githubToSlackMap.clear();
    this.isInitialized = false;
    Logger.info('Slack user cache cleared');
  }

  /**
   * Gets cache statistics for debugging
   * @returns {Object}
   */
  getCacheStats() {
    return {
      isInitialized: this.isInitialized,
      cachedUsersCount: this.cachedUsers ? this.cachedUsers.length : 0,
      githubToSlackMappings: this.githubToSlackMap.size,
    };
  }
}

module.exports = SlackUserService;
