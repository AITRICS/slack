module.exports = {
  action: 'created',
  comment: {
    author_association: 'COLLABORATOR',
    body: '무슨차이일까?',
    commit_id: '6272e4a1f3217844bec4994731fc5eac0afd206f',
    created_at: '2025-05-20T04:53:57Z',
    diff_hunk: '@@ -3,4 +3,4 @@ FROM alpine\n' +
    ' RUN --mount=type=secret,id=github_token,target=/tmp/user \\\n' +
    '   cat /tmp/user\n' +
    ' \n' +
    '-RUN echo "hihihihi"\n' +
    '+RUN echo "hihihidddhi"',
    html_url: 'https://github.com/AITRICS/ray-test/pull/23#discussion_r2096916332',
    id: 2096916332,
    in_reply_to_id: 2085982039,
    line: 6,
    node_id: 'PRRC_kwDOKhO1Fc58_Gds',
    original_commit_id: '6272e4a1f3217844bec4994731fc5eac0afd206f',
    original_line: 6,
    original_position: 5,
    original_start_line: null,
    path: 'Dockerfile',
    position: 5,
    pull_request_review_id: 2852607124,
    pull_request_url: 'https://api.github.com/repos/AITRICS/ray-test/pulls/23',
    reactions: {
      '+1': 0,
      '-1': 0,
      confused: 0,
      eyes: 0,
      heart: 0,
      hooray: 0,
      laugh: 0,
      rocket: 0,
      total_count: 0,
      url: 'https://api.github.com/repos/AITRICS/ray-test/pulls/comments/2096916332/reactions',
    },
    side: 'RIGHT',
    start_line: null,
    start_side: null,
    subject_type: 'line',
    updated_at: '2025-05-20T04:54:00Z',
    user: {
      login: 'aitrics-bot',
      id: 148510638,
      html_url: 'https://github.com/aitrics-bot',
    },
  },
  pull_request: {
    user: { login: 'aitrics-ray' },
    html_url: 'https://github.com/AITRICS/ray-test/pull/23',
    title: 'Test PR',
  },
  repository: {
    name: 'ray-test',
    full_name: 'AITRICS/ray-test',
    html_url: 'https://github.com/AITRICS/ray-test',
  },
  sender: {
    avatar_url: 'https://avatars.githubusercontent.com/u/148510638?v=4',
    html_url: 'https://github.com/aitrics-bot',
    id: 148510638,
    login: 'aitrics-bot',
    type: 'User',
  },
};
