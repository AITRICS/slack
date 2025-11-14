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
        requested_teams: [],
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
        requested_teams: [],
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
        requested_teams: [],
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
        requested_teams: [],
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

  describe('team reviewers', () => {
    it('should notify all team members when PR author comments', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'PR author comment to team',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'pr-author' },
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [],
        requested_teams: [{ slug: 'backend-team', name: 'Backend Team' }],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.gitHubApiHelper.fetchTeamMembers.mockResolvedValue([
        { login: 'team-member1' },
        { login: 'team-member2' },
        { login: 'team-member3' },
      ]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      expect(mockServices.gitHubApiHelper.fetchTeamMembers).toHaveBeenCalledWith('backend-team');

      const addSlackIdsCalls = mockServices.slackUserService.addSlackIdsToRecipients.mock.calls;
      const allRecipients = addSlackIdsCalls.flatMap((call) => call[0]);
      expect(allRecipients.some((r) => r.githubUsername === 'team-member1')).toBe(true);
      expect(allRecipients.some((r) => r.githubUsername === 'team-member2')).toBe(true);
      expect(allRecipients.some((r) => r.githubUsername === 'team-member3')).toBe(true);
    });

    it('should handle individual + team reviewers together', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'Comment to mixed reviewers',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'pr-author' },
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [{ login: 'individual-reviewer' }],
        requested_teams: [{ slug: 'backend-team', name: 'Backend Team' }],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.gitHubApiHelper.fetchTeamMembers.mockResolvedValue([
        { login: 'team-member1' },
        { login: 'team-member2' },
      ]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      const addSlackIdsCalls = mockServices.slackUserService.addSlackIdsToRecipients.mock.calls;
      const allRecipients = addSlackIdsCalls.flatMap((call) => call[0]);
      expect(allRecipients.some((r) => r.githubUsername === 'individual-reviewer')).toBe(true);
      expect(allRecipients.some((r) => r.githubUsername === 'team-member1')).toBe(true);
      expect(allRecipients.some((r) => r.githubUsername === 'team-member2')).toBe(true);
    });

    it('should deduplicate reviewers when same user is both individual and team member', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'Comment with duplicate reviewer',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'pr-author' },
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [{ login: 'duplicate-user' }],
        requested_teams: [{ slug: 'backend-team', name: 'Backend Team' }],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.gitHubApiHelper.fetchTeamMembers.mockResolvedValue([
        { login: 'duplicate-user' },
        { login: 'team-member' },
      ]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      const addSlackIdsCalls = mockServices.slackUserService.addSlackIdsToRecipients.mock.calls;
      const allRecipients = addSlackIdsCalls.flatMap((call) => call[0]);
      const duplicateUserCount = allRecipients.filter((r) => r.githubUsername === 'duplicate-user').length;

      // Set으로 중복 제거되므로 1번만 나타나야 함
      expect(duplicateUserCount).toBe(1);
    });

    it('should handle team fetch failure gracefully', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'Comment with team fetch error',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'pr-author' },
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [{ login: 'individual-reviewer' }],
        requested_teams: [{ slug: 'error-team', name: 'Error Team' }],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.gitHubApiHelper.fetchTeamMembers.mockRejectedValue(
        new Error('GitHub API Error'),
      );
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      // 에러가 발생해도 개별 리뷰어에게는 알림이 가야 함
      await handler.handleCommentEvent(payload);

      const addSlackIdsCalls = mockServices.slackUserService.addSlackIdsToRecipients.mock.calls;
      const allRecipients = addSlackIdsCalls.flatMap((call) => call[0]);
      expect(allRecipients.some((r) => r.githubUsername === 'individual-reviewer')).toBe(true);
    });

    it('should handle empty team', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'Comment to empty team',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'pr-author' },
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [],
        requested_teams: [{ slug: 'empty-team', name: 'Empty Team' }],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.gitHubApiHelper.fetchTeamMembers.mockResolvedValue([]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      // 빈 팀이어도 에러 없이 처리되어야 함
      expect(mockServices.slackMessageService.sendPRPageCommentMessage).not.toHaveBeenCalled();
    });

    it('should handle multiple teams', async () => {
      const payload = {
        repository: { name: 'test-repo', full_name: 'org/test-repo' },
        issue: { number: 1 },
        comment: {
          id: 123,
          body: 'Comment to multiple teams',
          html_url: 'https://github.com/org/test-repo/pull/1#comment-123',
          user: { login: 'pr-author' },
        },
      };

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [],
        requested_teams: [
          { slug: 'backend-team', name: 'Backend Team' },
          { slug: 'frontend-team', name: 'Frontend Team' },
        ],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.gitHubApiHelper.fetchTeamMembers
        .mockResolvedValueOnce([{ login: 'backend1' }, { login: 'backend2' }])
        .mockResolvedValueOnce([{ login: 'frontend1' }, { login: 'frontend2' }]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      await handler.handleCommentEvent(payload);

      expect(mockServices.gitHubApiHelper.fetchTeamMembers).toHaveBeenCalledWith('backend-team');
      expect(mockServices.gitHubApiHelper.fetchTeamMembers).toHaveBeenCalledWith('frontend-team');

      const addSlackIdsCalls = mockServices.slackUserService.addSlackIdsToRecipients.mock.calls;
      const allRecipients = addSlackIdsCalls.flatMap((call) => call[0]);
      expect(allRecipients.some((r) => r.githubUsername === 'backend1')).toBe(true);
      expect(allRecipients.some((r) => r.githubUsername === 'backend2')).toBe(true);
      expect(allRecipients.some((r) => r.githubUsername === 'frontend1')).toBe(true);
      expect(allRecipients.some((r) => r.githubUsername === 'frontend2')).toBe(true);
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

      mockServices.gitHubApiHelper.fetchCommentAuthor.mockRejectedValueOnce(
        new Error('Comment not found'),
      );

      mockServices.gitHubApiHelper.fetchPullRequestDetails.mockResolvedValue({
        number: 1,
        title: 'Test PR',
        html_url: 'https://github.com/org/test-repo/pull/1',
        user: { login: 'pr-author' },
        requested_reviewers: [],
        requested_teams: [],
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
        requested_teams: [],
      });
      mockServices.gitHubApiHelper.fetchPullRequestReviews.mockResolvedValue([]);
      mockServices.slackUserService.getSlackProperty.mockResolvedValue('Name');

      mockServices.slackChannelService.selectChannel
        .mockResolvedValueOnce('C11111')
        .mockResolvedValueOnce('C22222');

      await handler.handleCommentEvent(payload);

      expect(mockServices.slackChannelService.selectChannel).toHaveBeenCalledTimes(3);
    });
  });
});
