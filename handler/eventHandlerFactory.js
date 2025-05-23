const CommentEventHandler = require('./commentEventHandler');
const ReviewEventHandler = require('./reviewEventHandler');
const DeploymentEventHandler = require('./deploymentEventHandler');
const { ACTION_TYPES } = require('../constants');
const Logger = require('../utils/logger');

/**
 * Factory for creating event handlers
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
  }

  initializeHandlers() {
    const commentHandler = new CommentEventHandler(this.octokit, this.webClient);
    const reviewHandler = new ReviewEventHandler(this.octokit, this.webClient);
    const deploymentHandler = new DeploymentEventHandler(this.octokit, this.webClient);

    return {
      [ACTION_TYPES.COMMENT]: (payload) => commentHandler.handle(payload),
      [ACTION_TYPES.APPROVE]: (payload) => reviewHandler.handleApprove(payload),
      [ACTION_TYPES.REVIEW_REQUESTED]: (payload) => reviewHandler.handleReviewRequested(payload),
      [ACTION_TYPES.CHANGES_REQUESTED]: (payload) => reviewHandler.handleReviewRequested(payload),
      [ACTION_TYPES.SCHEDULE]: (payload) => reviewHandler.handleSchedule(payload),
      [ACTION_TYPES.DEPLOY]: (context, ...args) => deploymentHandler.handleDeploy(context, ...args),
      [ACTION_TYPES.CI]: (context, ...args) => deploymentHandler.handleBuild(context, ...args),
    };
  }

  /**
   * Gets a handler for the specified action type
   * @param {string} actionType
   * @returns {Function|null}
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
    const handler = this.getHandler(actionType);
    if (!handler) {
      throw new Error(`Unknown action type: ${actionType}`);
    }

    await handler(...args);
  }
}

module.exports = EventHandlerFactory;
