const CommentEventHandler = require('../../handler/commentEventHandler');
const { PayloadValidationError } = require('../../utils/errors');

describe('CommentEventHandler', () => {
  let handler;
  let mockServices;

  beforeEach(() => {
    mockServices = {
      gitHubApiHelper: {
        fetchTeamMembers: jest.fn(),
        fetchCommentAuthor: jest.fn(),
        fetchCommentThreadParticipants: jest.fn(),
        fetchPullRequestDetails: jest.fn(),
        fetchPullRequestReviews: jest.fn(),
      },
      slackUserService: {
        getSlackProperty: jest.fn(),
        getSlackProperties: jest.fn(),
        addSlackIdsToRecipients: jest.fn((recipients) => recipients.map((r) => ({
          ...r,
          slackId: `SLACK_${r.githubUsername}`,
        }))),
      },
      slackChannelService: {
        selectChannel: jest.fn().mockResolvedValue('C12345'),
      },
      slackMessageService: {
        sendCodeCommentMessage: jest.fn().mockResolvedValue(true),
        sendPRPageCommentMessage: jest.fn().mockResolvedValue(true),
      },
    };

    handler = new CommentEventHandler(mockServices);
  });

  describe('handleCommentEvent', () => {
    it('should handle code review comment', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        pull_request: {
          number: 1,
          title: 'Test PR',
          html_url: 'https://github.com/org/test-repo/pull/1',
          user: { login: 'pr-author' },
        },
        comment: {
          id: 123,
          body: 'Test comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          diff_hunk: '@@ -1,3 +1,3 @@',
          user: { login: 'reviewer' },
        },
      };

      mockServices.gitHubApiHelper.fetchCommentAuthor.mockResolvedValue('reviewer');
      mockServices.gitHubApiHelper.fetchCommentThreadParticipants.mockResolvedValue([
        'pr-author',
        'reviewer',
      ]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Reviewer Name');

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackMessageService.sendCodeCommentMessage).toHaveBeenCalled();
    });

    it('should handle PR page comment', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'Test comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'commenter' },
          issue_url: 'https://github.com/org/test-repo/issues/1',
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Commenter Name');

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackMessageService.sendPRPageCommentMessage).toHaveBeenCalled();
    });

    it('should throw error when payload is invalid', async () => {
      await expect(handler.handleCommentEvent(null)).rejects.toThrow(PayloadValidationError);
    });

    it('should throw error when PR number is missing', async () => {
      const payload = {
        repository: { name: 'test-repo' },
        comment: {
          id: 123,
          body: 'Test',
          user: { login: 'user' },
        },
      };

      await expect(handler.handleCommentEvent(payload)).rejects.toThrow('PR 번호를 찾을 수 없습니다');
    });
  });

  describe('comment type determination', () => {
    it('should identify code review comment', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        pull_request: {
          number: 1,
          user: { login: 'pr-author' },
          title: 'Test PR',
          html_url: 'https://github.com/org/test-repo/pull/1',
        },
        comment: {
          id: 123,
          body: 'Code review',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          diff_hunk: '@@ -1,3 +1,3 @@',
          user: { login: 'reviewer' },
          pull_request_url: 'https://api.github.com/repos/org/test-repo/pulls/1',
        },
      };

      mockServices.gitHubApiHelper.fetchCommentAuthor.mockResolvedValue('reviewer');
      mockServices.gitHubApiHelper.fetchCommentThreadParticipants.mockResolvedValue(['pr-author']);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackMessageService.sendCodeCommentMessage).toHaveBeenCalled();
    });

    it('should identify PR page comment', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'PR page comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'commenter' },
          issue_url: 'https://api.github.com/repos/org/test-repo/issues/1',
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackMessageService.sendPRPageCommentMessage).toHaveBeenCalled();
    });
  });

  describe('recipient determination', () => {
    it('should send to PR author for first time code comment', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        pull_request: {
          number: 1,
          title: 'Test PR',
          html_url: 'https://github.com/org/test-repo/pull/1',
          user: { login: 'pr-author' },
        },
        comment: {
          id: 123,
          body: 'First comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          diff_hunk: '@@ -1,3 +1,3 @@',
          user: { login: 'reviewer' },
        },
      };

      mockServices.gitHubApiHelper.fetchCommentAuthor.mockResolvedValue('reviewer');
      mockServices.gitHubApiHelper.fetchCommentThreadParticipants.mockResolvedValue(['reviewer']);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackChannelService.selectChannel).toHaveBeenCalledWith('pr-author');
    });

    it('should send to thread participants for subsequent comments', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        pull_request: {
          number: 1,
          title: 'Test PR',
          html_url: 'https://github.com/org/test-repo/pull/1',
          user: { login: 'pr-author' },
        },
        comment: {
          id: 123,
          body: 'Reply comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          diff_hunk: '@@ -1,3 +1,3 @@',
          user: { login: 'reviewer2' },
        },
      };

      mockServices.gitHubApiHelper.fetchCommentAuthor.mockResolvedValue('reviewer2');
      mockServices.gitHubApiHelper.fetchCommentThreadParticipants.mockResolvedValue([
        'pr-author',
        'reviewer1',
        'reviewer2',
      ]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackMessageService.sendCodeCommentMessage).toHaveBeenCalled();
    });

    it('should send to all reviewers when PR author comments', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'PR author comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'pr-author' },
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [{ login: 'reviewer1' }],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([
        { user: { login: 'reviewer2' } },
      ]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      const addSlackIdsCalls = mockServices.slackUserService.addSlackIdsToRecipients.mock.calls;
      const allRecipients = addSlackIdsCalls.flatMap((call) => call[0]);
      expect(allRecipients.some((r) => r.githubUsername === 'reviewer1')).toBe(true);
      expect(allRecipients.some((r) => r.githubUsername === 'reviewer2')).toBe(true);
    });

    it('should send to PR author and other reviewers when reviewer comments', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'Reviewer comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'reviewer1' },
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([
        { user: { login: 'reviewer1' } },
        { user: { login: 'reviewer2' } },
      ]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackMessageService.sendPRPageCommentMessage).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should fallback to PR page comment when code comment fails', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        pull_request: {
          number: 1,
          title: 'Test PR',
          html_url: 'https://github.com/org/test-repo/pull/1',
          user: { login: 'pr-author' },
        },
        comment: {
          id: 123,
          body: 'Comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          diff_hunk: '@@ -1,3 +1,3 @@',
          user: { login: 'reviewer' },
        },
      };

      // 코드 코멘트로 처리하려다 실패
      mockServices.gitHubApiHelper.fetchCommentAuthor.mockRejectedValueOnce(
        new Error('Comment not found'),
      );

      // PR 페이지 코멘트로 폴백
      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackMessageService.sendPRPageCommentMessage).toHaveBeenCalled();
    });

    it('should skip notification when no recipients', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        pull_request: {
          number: 1,
          title: 'Test PR',
          html_url: 'https://github.com/org/test-repo/pull/1',
          user: { login: 'pr-author' },
        },
        comment: {
          id: 123,
          body: 'Self comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          diff_hunk: '@@ -1,3 +1,3 @@',
          user: { login: 'pr-author' },
        },
      };

      mockServices.gitHubApiHelper.fetchCommentAuthor.mockResolvedValue('pr-author');
      mockServices.gitHubApiHelper.fetchCommentThreadParticipants.mockResolvedValue(['pr-author']);

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackMessageService.sendCodeCommentMessage).not.toHaveBeenCalled();
    });
  });

  describe('channel grouping', () => {
    it('should group recipients by channel', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'Comment',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'commenter' },
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [
          { login: 'reviewer1' },
          { login: 'reviewer2' },
        ],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      // 다른 채널 반환
      mockServices.slackChannelService.selectChannel
        .mockResolvedValueOnce('C11111')
        .mockResolvedValueOnce('C22222');

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackChannelService.selectChannel).toHaveBeenCalledTimes(3);
    });
  });
});
