// GitHub 조직 설정
const GITHUB_CONFIG = Object.freeze({
  ORGANIZATION: 'aitrics',
  TEAM_SLUGS: Object.freeze(['SE', 'Platform-frontend', 'Platform-backend']),
});

// Slack 채널 매핑
const SLACK_CHANNELS = Object.freeze({
  SE: 'C06CS5Q4L8G',
  'Platform-frontend': 'C06B5J3KD8F',
  'Platform-backend': 'C06C8TLTURE',
  gitAny: 'C06CMAY8066', // 기본 채널
  deploy: 'C06CMU2S6JY',
});

// Slack 메시지 설정
const SLACK_CONFIG = Object.freeze({
  SKIP_USERS: Object.freeze(['john (이주호)']), // 알림 제외 사용자

  MESSAGE_COLORS: Object.freeze({
    SUCCESS: 'good',
    DANGER: 'danger',
    WARNING: 'warning',
    INFO: '#439FE0',
  }),

  ICONS: Object.freeze({
    COMMENT: ':pencil:',
    PR_COMMENT: ':speech_balloon:',
    APPROVE: ':white_check_mark:',
    REVIEW_REQUEST: ':eyes:',
    SUCCESS: ':white_check_mark:',
    FAILURE: ':x:',
    WARNING: ':warning:',
    INFO: ':information_source:',
  }),

  MESSAGE_TEMPLATES: Object.freeze({
    // 액션 메시지
    CODE_COMMENT: '님이 코멘트를 남겼어요!!',
    PR_COMMENT: '님이 코멘트를 남겼어요!!',
    APPROVE: '님이 Approve를 했습니다!!',
    REVIEW_REQUEST: '님이 Review를 요청했습니다!!',
    SCHEDULE_REVIEW: '에서 리뷰를 기다리고 있습니다.',

    // Attachment 텍스트
    COMMENT_CONTENT: '*코멘트 내용:*',
    VIEW_COMMENT: '코멘트 보러가기',
    VIEW_PR: 'PR 보러가기',

    // 필드 제목
    DEPLOY_INFO: 'Deploy Info',
    BUILD_INFO: 'Build Info',
    FAILED_JOBS: 'Failed Jobs',
    REPOSITORY: 'Repository',
    DEPLOY_SERVER: 'Deploy Server',
    AUTHOR: 'Author',
    COMMIT: 'Commit',
    IMAGE_TAG: 'Image Tag',
    RUN_TIME: 'Run Time',
    WORKFLOW: 'Workflow',
    REF: 'Ref',
    BRANCH: 'Branch',

    // 알림 제목
    DEPLOY_NOTIFICATION: '*GitHub Actions Deploy Notification*',
    BUILD_NOTIFICATION: '*GitHub Actions Build Notification*',
  }),
});

// PR 리뷰 상태
const REVIEW_STATES = Object.freeze({
  AWAITING: 'AWAITING',
  COMMENTED: 'COMMENTED',
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  DISMISSED: 'DISMISSED',
});

// 작업 상태
const JOB_STATUS = Object.freeze({
  SUCCESS: 'success',
  FAILURE: 'failure',
  CANCELLED: 'cancelled',
  SKIPPED: 'skipped',
});

// 액션 타입
const ACTION_TYPES = Object.freeze({
  SCHEDULE: 'schedule',
  APPROVE: 'approve',
  COMMENT: 'comment',
  REVIEW_REQUESTED: 'review_requested',
  CHANGES_REQUESTED: 'changes_requested',
  DEPLOY: 'deploy',
  CI: 'ci',
});

// API 제한 및 재시도 설정
const API_CONFIG = Object.freeze({
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  REQUEST_TIMEOUT_MS: 30000,
  RATE_LIMIT_BUFFER: 100, // GitHub API rate limit buffer
});

// 로깅 레벨
const LOG_LEVELS = Object.freeze({
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
});

module.exports = {
  GITHUB_CONFIG,
  SLACK_CHANNELS,
  SLACK_CONFIG,
  REVIEW_STATES,
  JOB_STATUS,
  ACTION_TYPES,
  API_CONFIG,
  LOG_LEVELS,
};