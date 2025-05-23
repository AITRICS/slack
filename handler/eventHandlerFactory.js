const CommentEventHandler = require('./commentEventHandler');
const ReviewEventHandler = require('./reviewEventHandler');
const DeploymentEventHandler = require('./deploymentEventHandler');
const { ACTION_TYPES } = require('../constants');
const Logger = require('../utils/logger');

/**
 * Factory for creating event handlers with optimized Slack API usage
 */
class EventHandlerFactory {
  /**
   * @param {import('@octokit/rest').Octokit} octokit
   * @param {import('@slack/web-api').WebClient} webClient
   */
  constructor(octokit, webClient) {
    this.octokit = octokit;
    this.webClient = webClient;
    this.handlers = this.initializeHandlers();
    this.isInitialized = false;
  }

  initializeHandlers() {
    const commentHandler = new CommentEventHandler(this.octokit, this.webClient);
    const reviewHandler = new ReviewEventHandler(this.octokit, this.webClient);
    const deploymentHandler = new DeploymentEventHandler(this.octokit, this.webClient);

    return {
      [ACTION_TYPES.COMMENT]: commentHandler,
      [ACTION_TYPES.APPROVE]: reviewHandler,
      [ACTION_TYPES.REVIEW_REQUESTED]: reviewHandler,
      [ACTION_TYPES.CHANGES_REQUESTED]: reviewHandler,
      [ACTION_TYPES.SCHEDULE]: reviewHandler,
      [ACTION_TYPES.DEPLOY]: deploymentHandler,
      [ACTION_TYPES.CI]: deploymentHandler,
    };
  }

  /**
   * Pre-initializes all handlers (especially Slack user cache)
   * @returns {Promise<void>}
   */
  async preInitialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      Logger.info('Pre-initializing event handlers...');

      // Initialize all unique handlers
      const uniqueHandlers = [...new Set(Object.values(this.handlers))];
      await Promise.all(uniqueHandlers.map((handler) => handler.initialize()));

      this.isInitialized = true;
      Logger.info('All event handlers pre-initialized successfully');
    } catch (error) {
      Logger.error('Failed to pre-initialize event handlers', error);
      // Don't throw, allow individual handlers to initialize on demand
    }
  }

  /**
   * Gets a handler for the specified action type
   * @param {string} actionType
   * @returns {Object|null}
   */
  getHandler(actionType) {
    const handler = this.handlers[actionType];
    if (!handler) {
      Logger.error(`No handler found for action type: ${actionType}`);
      return null;
    }
    return handler;
  }

  /**
   * Handles an event based on action type
   * @param {string} actionType
   * @param {...any} args
   * @returns {Promise<void>}
   */
  async handleEvent(actionType, ...args) {
    // Pre-initialize if not done
    if (!this.isInitialized) {
      await this.preInitialize();
    }

    const handler = this.getHandler(actionType);
    if (!handler) {
      throw new Error(`Unknown action type: ${actionType}`);
    }

    // Call the appropriate method based on action type
    switch (actionType) {
      case ACTION_TYPES.COMMENT:
        await handler.handle(...args);
        break;
      case ACTION_TYPES.APPROVE:
        await handler.handleApprove(...args);
        break;
      case ACTION_TYPES.REVIEW_REQUESTED:
      case ACTION_TYPES.CHANGES_REQUESTED:
        await handler.handleReviewRequested(...args);
        break;
      case ACTION_TYPES.SCHEDULE:
        await handler.handleSchedule(...args);
        break;
      case ACTION_TYPES.DEPLOY:
        await handler.handleDeploy(...args);
        break;
      case ACTION_TYPES.CI:
        await handler.handleBuild(...args);
        break;
      default:
        throw new Error(`Unhandled action type: ${actionType}`);
    }
  }

  /**
   * Gets cache statistics for all handlers
   * @returns {Object}
   */
  getCacheStats() {
    const stats = {
      isFactoryInitialized: this.isInitialized,
      handlers: {},
    };

    Object.entries(this.handlers).forEach(([actionType, handler]) => {
      if (handler.getCacheStats) {
        stats.handlers[actionType] = handler.getCacheStats();
      }
    });

    return stats;
  }
}

module.exports = EventHandlerFactory;
