const mockSlackMembers = [
  {
    id: 'U12345',
    real_name: '최경환',
    deleted: false,
    profile: { display_name: 'ray' },
  },
  {
    id: 'U67890',
    real_name: '김철수',
    deleted: false,
    profile: { display_name: '김철수' },
  },
  {
    id: 'U54321',
    real_name: 'john (이주호)',
    deleted: false,
    profile: { display_name: 'john' },
  },
  {
    id: 'U11111',
    real_name: '박지민',
    deleted: false,
    profile: { display_name: 'jimin' },
  },
  {
    id: 'U22222',
    real_name: '이동민 (Rooney)',
    deleted: false,
    profile: { display_name: 'Rooney' },
  },
  {
    id: 'U33333',
    real_name: '',
    deleted: false,
    profile: { display_name: 'emptyName' },
  },
  {
    id: 'U44444',
    real_name: 'deletedUser',
    deleted: true,
    profile: { display_name: 'deleted' },
  },
];

const createMockOctokit = () => ({
  teams: {
    listMembersInOrg: jest.fn(),
  },
  rest: {
    pulls: {
      getReviewComment: jest.fn(),
      listReviews: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
    },
    users: {
      getByUsername: jest.fn(),
    },
  },
  actions: {
    getWorkflowRun: jest.fn(),
  },
});

const createMockSlackWeb = () => {
  const mockPostMessage = jest.fn().mockImplementation(() => Promise.resolve({ ok: true }));
  const mockUsersList = jest.fn().mockImplementation(() => Promise.resolve({
    members: mockSlackMembers,
  }));

  return {
    chat: { postMessage: mockPostMessage },
    users: { list: mockUsersList },
    _mockFunctions: { mockPostMessage, mockUsersList },
  };
};

const setupDefaultMocks = (mockOctokit) => {
  mockOctokit.rest.users.getByUsername.mockResolvedValue({
    data: { name: 'test-user', login: 'test-user' },
  });
  mockOctokit.teams.listMembersInOrg.mockResolvedValue({
    data: [{ login: 'test-user' }],
  });
  mockOctokit.rest.pulls.getReviewComment.mockResolvedValue({
    data: { user: { login: 'comment-author' } },
  });
  mockOctokit.rest.pulls.listReviews.mockResolvedValue({ data: [] });
  mockOctokit.rest.pulls.get.mockResolvedValue({
    data: { requested_reviewers: [] },
  });
};

module.exports = {
  mockSlackMembers,
  createMockOctokit,
  createMockSlackWeb,
  setupDefaultMocks,
};
