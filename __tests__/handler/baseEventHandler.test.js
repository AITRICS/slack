const BaseEventHandler = require('../../handler/baseEventHandler');
const { PayloadValidationError } = require('../../utils/errors');

describe('BaseEventHandler', () => {
  let mockServices;

  beforeEach(() => {
    mockServices = {
      gitHubApiHelper: { fetchTeamMembers: jest.fn() },
      slackUserService: { getSlackProperty: jest.fn() },
      slackChannelService: { selectChannel: jest.fn() },
      slackMessageService: { sendMessage: jest.fn() },
    };
  });

  describe('constructor', () => {
    it('should create instance with all required services', () => {
      const handler = new BaseEventHandler(mockServices);

      expect(handler.gitHubApiHelper).toBe(mockServices.gitHubApiHelper);
      expect(handler.slackUserService).toBe(mockServices.slackUserService);
      expect(handler.slackChannelService).toBe(mockServices.slackChannelService);
      expect(handler.slackMessageService).toBe(mockServices.slackMessageService);
      expect(handler.initialized).toBe(false);
    });

    it('should throw error when required service is missing', () => {
      const incompleteServices = {
        gitHubApiHelper: {},
        slackUserService: {},
        // slackChannelService 누락
        slackMessageService: {},
      };

      expect(() => new BaseEventHandler(incompleteServices)).toThrow(
        '필수 서비스가 누락되었습니다: slackChannelService',
      );
    });

    it('should throw error when multiple services are missing', () => {
      const incompleteServices = {
        gitHubApiHelper: {},
        // 나머지 누락
      };

      expect(() => new BaseEventHandler(incompleteServices)).toThrow('필수 서비스가 누락되었습니다');
    });
  });

  describe('initialize', () => {
    it('should set initialized flag to true', async () => {
      const handler = new BaseEventHandler(mockServices);

      await handler.initialize();

      expect(handler.initialized).toBe(true);
    });

    it('should not reinitialize when called multiple times', async () => {
      const handler = new BaseEventHandler(mockServices);

      await handler.initialize();
      const firstInitState = handler.initialized;

      await handler.initialize();
      const secondInitState = handler.initialized;

      expect(firstInitState).toBe(true);
      expect(secondInitState).toBe(true);
    });
  });

  describe('validatePayload (static)', () => {
    it('should throw error when payload is null', () => {
      expect(() => BaseEventHandler.validatePayload(null)).toThrow(PayloadValidationError);
      expect(() => BaseEventHandler.validatePayload(null)).toThrow('페이로드가 없습니다');
    });

    it('should throw error when payload is undefined', () => {
      expect(() => BaseEventHandler.validatePayload(undefined)).toThrow(PayloadValidationError);
      expect(() => BaseEventHandler.validatePayload(undefined)).toThrow('페이로드가 없습니다');
    });

    it('should throw error when repository is missing', () => {
      const payload = { action: 'opened' };

      expect(() => BaseEventHandler.validatePayload(payload)).toThrow(PayloadValidationError);
      expect(() => BaseEventHandler.validatePayload(payload)).toThrow('repository 정보가 없습니다');
    });

    it('should not throw error when payload is valid', () => {
      const payload = {
        action: 'opened',
        repository: { name: 'test-repo' },
      };

      expect(() => BaseEventHandler.validatePayload(payload)).not.toThrow();
    });
  });

  describe('extractRepoData (static)', () => {
    it('should extract repository information', () => {
      const repository = {
        name: 'test-repo',
        full_name: 'user/test-repo',
        html_url: 'https://github.com/user/test-repo',
      };

      const result = BaseEventHandler.extractRepoData(repository);

      expect(result).toEqual({
        name: 'test-repo',
        fullName: 'user/test-repo',
        url: 'https://github.com/user/test-repo',
      });
    });

    it('should handle minimal repository data', () => {
      const repository = {
        name: 'minimal',
        full_name: 'org/minimal',
        html_url: 'https://github.com/org/minimal',
      };

      const result = BaseEventHandler.extractRepoData(repository);

      expect(result.name).toBe('minimal');
      expect(result.fullName).toBe('org/minimal');
      expect(result.url).toBe('https://github.com/org/minimal');
    });
  });
});
