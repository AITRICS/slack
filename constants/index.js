// GitHub 조직 설정
const GITHUB_CONFIG = {
  ORGANIZATION: 'aitrics',
  TEAM_SLUGS: ['SE', 'Platform-frontend', 'Platform-backend'],
};

// Slack 채널 매핑
const SLACK_CHANNELS = {
  SE: 'C06CS5Q4L8G',
  'Platform-frontend': 'C06B5J3KD8F',
  'Platform-backend': 'C06C8TLECTURE',
  gitAny: 'C06CMAY8066', // 기본 채널
  deploy: 'C06CMU2S6JY',
};

// Slack 메시지 설정
const SLACK_CONFIG = {
  SKIP_USERS: ['john (이주호)'], // 알림 제외 사용자
  MESSAGE_COLORS: {
    SUCCESS: 'good',
    DANGER: 'danger',
  },
  ICONS: {
    COMMENT: ':pencil:',
    PR_COMMENT: ':speech_balloon:',
    APPROVE: ':white_check_mark:',
    REVIEW_REQUEST: ':eyes:',
    SUCCESS: ':white_check_mark:',
    FAILURE: ':x:',
  },
};

// PR 리뷰 상태
const REVIEW_STATES = {
  AWAITING: 'AWAITING',
  COMMENTED: 'COMMENTED',
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
};

// 작업 상태
const JOB_STATUS = {
  SUCCESS: 'success',
  FAILURE: 'failure',
};

// 액션 타입
const ACTION_TYPES = {
  SCHEDULE: 'schedule',
  APPROVE: 'approve',
  COMMENT: 'comment',
  REVIEW_REQUESTED: 'review_requested',
  CHANGES_REQUESTED: 'changes_requested',
  DEPLOY: 'deploy',
  CI: 'ci',
};

module.exports = {
  GITHUB_CONFIG,
  SLACK_CHANNELS,
  SLACK_CONFIG,
  REVIEW_STATES,
  JOB_STATUS,
  ACTION_TYPES,
};
