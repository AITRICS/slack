const BaseEventHandler = require('../../handler/baseEventHandler');
const { PayloadValidationError } = require('../../utils/errors');

describe('BaseEventHandler', () => {
  let mockServices;

  beforeEach(() => {
    mockServices = {
      gitHubApiHelper: {
        fetchTeamMembers: jest.fn(),
        fetchPullRequestReviews: jest.fn(),
        fetchPullRequestDetails: jest.fn(),
      },
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

  describe('fetchTeamMembers', () => {
    it('should return empty array when requestedTeams is empty', async () => {
      const handler = new BaseEventHandler(mockServices);

      const result = await handler.fetchTeamMembers([]);

      expect(result).toEqual([]);
      expect(mockServices.gitHubApiHelper.fetchTeamMembers).not.toHaveBeenCalled();
    });

    it('should return empty array when requestedTeams is null', async () => {
      const handler = new BaseEventHandler(mockServices);

      const result = await handler.fetchTeamMembers(null);

      expect(result).toEqual([]);
      expect(mockServices.gitHubApiHelper.fetchTeamMembers).not.toHaveBeenCalled();
    });

    it('should fetch team members for single team', async () => {
      const handler = new BaseEventHandler(mockServices);
      const requestedTeams = [{ slug: 'backend' }];

      mockServices.gitHubApiHelper.fetchTeamMembers.mockResolvedValue([
        { login: 'member1' },
        { login: 'member2' },
      ]);

      const result = await handler.fetchTeamMembers(requestedTeams);

      expect(result).toEqual(['member1', 'member2']);
      expect(mockServices.gitHubApiHelper.fetchTeamMembers).toHaveBeenCalledWith('backend');
    });

    it('should fetch and flatten team members for multiple teams', async () => {
      const handler = new BaseEventHandler(mockServices);
      const requestedTeams = [
        { slug: 'backend' },
        { slug: 'frontend' },
      ];

      mockServices.gitHubApiHelper.fetchTeamMembers
        .mockResolvedValueOnce([
          { login: 'backend1' },
          { login: 'backend2' },
        ])
        .mockResolvedValueOnce([
          { login: 'frontend1' },
        ]);

      const result = await handler.fetchTeamMembers(requestedTeams);

      expect(result).toEqual(['backend1', 'backend2', 'frontend1']);
      expect(mockServices.gitHubApiHelper.fetchTeamMembers).toHaveBeenCalledTimes(2);
      expect(mockServices.gitHubApiHelper.fetchTeamMembers).toHaveBeenCalledWith('backend');
      expect(mockServices.gitHubApiHelper.fetchTeamMembers).toHaveBeenCalledWith('frontend');
    });

    it('should handle team fetch failure gracefully', async () => {
      const handler = new BaseEventHandler(mockServices);
      const requestedTeams = [
        { slug: 'valid-team' },
        { slug: 'error-team' },
      ];

      mockServices.gitHubApiHelper.fetchTeamMembers
        .mockResolvedValueOnce([{ login: 'member1' }])
        .mockRejectedValueOnce(new Error('GitHub API Error'));

      const result = await handler.fetchTeamMembers(requestedTeams);

      expect(result).toEqual(['member1']);
    });

    it('should handle all teams failing', async () => {
      const handler = new BaseEventHandler(mockServices);
      const requestedTeams = [
        { slug: 'error-team1' },
        { slug: 'error-team2' },
      ];

      mockServices.gitHubApiHelper.fetchTeamMembers
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'));

      const result = await handler.fetchTeamMembers(requestedTeams);

      expect(result).toEqual([]);
    });
  });

  describe('fetchAllReviewers', () => {
    it('should fetch individual reviewers only', async () => {
      const handler = new BaseEventHandler(mockServices);
      const prDetails = {
        user: { login: 'author' },
        requested_reviewers: [
          { login: 'reviewer1' },
          { login: 'reviewer2' },
        ],
        requested_teams: [],
      };

      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);

      const result = await handler.fetchAllReviewers('test-repo', 1, prDetails);

      expect(result).toEqual(['reviewer1', 'reviewer2']);
      expect(mockServices.gitHubApiHelper.fetchPullRequestReviews).toHaveBeenCalledWith('test-repo', 1);
    });

    it('should fetch team reviewers and flatten', async () => {
      const handler = new BaseEventHandler(mockServices);
      const prDetails = {
        user: { login: 'author' },
        requested_reviewers: [],
        requested_teams: [{ slug: 'backend' }],
      };

      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.gitHubApiHelper.fetchTeamMembers.mockResolvedValue([
        { login: 'team-member1' },
        { login: 'team-member2' },
      ]);

      const result = await handler.fetchAllReviewers('test-repo', 1, prDetails);

      expect(result).toEqual(['team-member1', 'team-member2']);
    });

    it('should include actual reviewers from reviews', async () => {
      const handler = new BaseEventHandler(mockServices);
      const prDetails = {
        user: { login: 'author' },
        requested_reviewers: [],
        requested_teams: [],
      };

      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([
        { user: { login: 'actual-reviewer1' }, state: 'APPROVED' },
        { user: { login: 'actual-reviewer2' }, state: 'COMMENTED' },
      ]);

      const result = await handler.fetchAllReviewers('test-repo', 1, prDetails);

      expect(result).toEqual(['actual-reviewer1', 'actual-reviewer2']);
    });

    it('should combine and deduplicate all reviewer types', async () => {
      const handler = new BaseEventHandler(mockServices);
      const prDetails = {
        user: { login: 'author' },
        requested_reviewers: [
          { login: 'individual1' },
          { login: 'duplicate-user' },
        ],
        requested_teams: [{ slug: 'backend' }],
      };

      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([
        { user: { login: 'duplicate-user' }, state: 'APPROVED' },
        { user: { login: 'actual-reviewer' }, state: 'COMMENTED' },
      ]);

      mockServices.gitHubApiHelper.fetchTeamMembers.mockResolvedValue([
        { login: 'team-member1' },
        { login: 'duplicate-user' },
      ]);

      const result = await handler.fetchAllReviewers('test-repo', 1, prDetails);

      expect(result).toEqual([
        'individual1',
        'duplicate-user',
        'team-member1',
        'actual-reviewer',
      ]);
      expect(new Set(result).size).toBe(result.length); // 중복 없음 확인
    });

    it('should handle empty prDetails gracefully', async () => {
      const handler = new BaseEventHandler(mockServices);
      const prDetails = {
        user: { login: 'author' },
      };

      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);

      const result = await handler.fetchAllReviewers('test-repo', 1, prDetails);

      expect(result).toEqual([]);
    });

    it('should handle null requested_reviewers and requested_teams', async () => {
      const handler = new BaseEventHandler(mockServices);
      const prDetails = {
        user: { login: 'author' },
        requested_reviewers: null,
        requested_teams: null,
      };

      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([
        { user: { login: 'reviewer1' }, state: 'APPROVED' },
      ]);

      const result = await handler.fetchAllReviewers('test-repo', 1, prDetails);

      expect(result).toEqual(['reviewer1']);
    });
  });
});
