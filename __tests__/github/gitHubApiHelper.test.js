const GitHubApiHelper = require('../../github/gitHubApiHelper');
const { createMockOctokit } = require('../mocks/commonMocks');
const { GitHubAPIError } = require('../../utils/errors');

describe('GitHubApiHelper', () => {
  let gitHubApiHelper;
  let mockOctokit;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOctokit = createMockOctokit();
    gitHubApiHelper = new GitHubApiHelper(mockOctokit);
  });

  describe('팀 멤버 조회', () => {
    it('팀 멤버 목록 조회 성공', async () => {
      const mockMembers = [{ login: 'member1' }, { login: 'member2' }];
      mockOctokit.teams.listMembersInOrg.mockResolvedValue({ data: mockMembers });

      const result = await gitHubApiHelper.fetchTeamMembers('SE');

      expect(mockOctokit.teams.listMembersInOrg).toHaveBeenCalledWith({
        org: 'aitrics',
        team_slug: 'SE',
      });
      expect(result).toEqual(mockMembers);
    });

    it('팀 멤버 조회 실패 시 에러 처리', async () => {
      const error = new Error('API Error');
      mockOctokit.teams.listMembersInOrg.mockRejectedValue(error);

      await expect(gitHubApiHelper.fetchTeamMembers('SE')).rejects.toThrow(GitHubAPIError);
      await expect(gitHubApiHelper.fetchTeamMembers('SE')).rejects.toThrow('팀 멤버 조회 실패');
    });
  });

  describe('PR 관련 조회', () => {
    it('PR 상세 정보 조회', async () => {
      const mockPRDetails = { number: 1, title: 'Test PR' };
      mockOctokit.rest.pulls.get.mockResolvedValue({ data: mockPRDetails });

      const result = await gitHubApiHelper.fetchPullRequestDetails('test-repo', 1);

      expect(mockOctokit.rest.pulls.get).toHaveBeenCalledWith({
        owner: 'aitrics',
        repo: 'test-repo',
        pull_number: 1,
      });
      expect(result).toEqual(mockPRDetails);
    });

    it('PR 리뷰 목록 조회', async () => {
      const mockReviews = [{ id: 1, state: 'approved' }];
      mockOctokit.rest.pulls.listReviews.mockResolvedValue({ data: mockReviews });

      const result = await gitHubApiHelper.fetchPullRequestReviews('test-repo', 1);

      expect(mockOctokit.rest.pulls.listReviews).toHaveBeenCalledWith({
        owner: 'aitrics',
        repo: 'test-repo',
        pull_number: 1,
      });
      expect(result).toEqual(mockReviews);
    });

    it('열린 PR 목록 조회', async () => {
      const mockPRs = [{ number: 1 }, { number: 2 }];
      mockOctokit.rest.pulls.list.mockResolvedValue({ data: mockPRs });

      const result = await gitHubApiHelper.fetchOpenPullRequests('test-repo');

      expect(mockOctokit.rest.pulls.list).toHaveBeenCalledWith({
        owner: 'aitrics',
        repo: 'test-repo',
        state: 'open',
      });
      expect(result).toEqual(mockPRs);
    });
  });

  describe('코멘트 작성자 조회', () => {
    it('리뷰 코멘트 작성자 조회 성공', async () => {
      mockOctokit.rest.pulls.getReviewComment.mockResolvedValue({
        data: { user: { login: 'commenter' } },
      });

      const result = await gitHubApiHelper.fetchCommentAuthor('test-repo', 123);

      expect(mockOctokit.rest.pulls.getReviewComment).toHaveBeenCalledWith({
        owner: 'aitrics',
        repo: 'test-repo',
        comment_id: 123,
      });
      expect(result).toBe('commenter');
    });

    it('코멘트 작성자 조회 실패 시 에러 처리', async () => {
      const error = new Error('Comment not found');
      mockOctokit.rest.pulls.getReviewComment.mockRejectedValue(error);

      await expect(gitHubApiHelper.fetchCommentAuthor('test-repo', 123)).rejects.toThrow(GitHubAPIError);
      await expect(gitHubApiHelper.fetchCommentAuthor('test-repo', 123)).rejects.toThrow('코멘트 작성자 조회 실패');
    });
  });

  describe('사용자 정보 조회', () => {
    it('GitHub 사용자 실명 조회 - 이름이 있는 경우', async () => {
      mockOctokit.rest.users.getByUsername.mockResolvedValue({
        data: { name: '홍길동', login: 'hong' },
      });

      const result = await gitHubApiHelper.fetchUserRealName('hong');

      expect(mockOctokit.rest.users.getByUsername).toHaveBeenCalledWith({
        username: 'hong',
      });
      expect(result).toBe('홍길동');
    });

    it('GitHub 사용자 실명 조회 - 이름이 없는 경우', async () => {
      mockOctokit.rest.users.getByUsername.mockResolvedValue({
        data: { name: null, login: 'hong' },
      });

      const result = await gitHubApiHelper.fetchUserRealName('hong');

      expect(result).toBe('hong');
    });

    it('GitHub 사용자 조회 실패 시 에러 처리', async () => {
      const error = new Error('User not found');
      mockOctokit.rest.users.getByUsername.mockRejectedValue(error);

      await expect(gitHubApiHelper.fetchUserRealName('nonexistent')).rejects.toThrow(GitHubAPIError);
      await expect(gitHubApiHelper.fetchUserRealName('nonexistent')).rejects.toThrow('사용자 정보 조회 실패');
    });
  });

  describe('GitHub Actions 관련', () => {
    it('워크플로우 실행 정보 조회', async () => {
      const mockRunData = {
        name: 'CI',
        html_url: 'https://github.com/test/repo/actions/runs/123',
        run_started_at: '2025-05-22T10:00:00Z',
        actor: { login: 'developer' },
      };
      mockOctokit.actions.getWorkflowRun.mockResolvedValue({ data: mockRunData });

      const result = await gitHubApiHelper.fetchWorkflowRunData('test-repo', '123');

      expect(mockOctokit.actions.getWorkflowRun).toHaveBeenCalledWith({
        owner: 'aitrics',
        repo: 'test-repo',
        run_id: '123',
      });
      expect(result).toEqual(mockRunData);
    });

    it('워크플로우 실행 정보 조회 실패 시 에러 처리', async () => {
      const error = new Error('Workflow run not found');
      mockOctokit.actions.getWorkflowRun.mockRejectedValue(error);

      await expect(gitHubApiHelper.fetchWorkflowRunData('test-repo', '123')).rejects.toThrow(GitHubAPIError);
      await expect(gitHubApiHelper.fetchWorkflowRunData('test-repo', '123')).rejects.toThrow('워크플로우 실행 조회 실패');
    });
  });
});
