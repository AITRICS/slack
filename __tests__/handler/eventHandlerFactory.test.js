const EventHandlerFactory = require('../../handler/eventHandlerFactory');
const { ACTION_TYPES } = require('../../constants');
const { createMockOctokit, createMockSlackWeb } = require('../mocks/commonMocks');

describe('EventHandlerFactory', () => {
  let factory;
  let mockOctokit;
  let mockWeb;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOctokit = createMockOctokit();
    mockWeb = createMockSlackWeb();
    factory = new EventHandlerFactory(mockOctokit, mockWeb);
  });

  describe('getHandler', () => {
    it('should return handler for valid action types', () => {
      Object.values(ACTION_TYPES).forEach((actionType) => {
        const handler = factory.getHandler(actionType);
        expect(handler).toBeDefined();
        expect(typeof handler).toBe('function');
      });
    });

    it('should return null for unknown action type', () => {
      const handler = factory.getHandler('unknown_action');
      expect(handler).toBeNull();
    });
  });

  describe('handleEvent', () => {
    it('should handle valid action type', async () => {
      const payload = { test: 'data' };

      // Mock the handler method
      const mockHandler = jest.fn();
      factory.handlers[ACTION_TYPES.SCHEDULE] = mockHandler;

      await factory.handleEvent(ACTION_TYPES.SCHEDULE, payload);

      expect(mockHandler).toHaveBeenCalledWith(payload);
    });

    it('should throw error for unknown action type', async () => {
      await expect(factory.handleEvent('unknown_action', {}))
        .rejects.toThrow('Unknown action type: unknown_action');
    });
  });
});
