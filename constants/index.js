const GITHUB_CONFIG = {
  ORGANIZATION: 'aitrics',
  TEAM_SLUGS: ['SE', 'Platform-frontend', 'Platform-backend'],
};

const SLACK_CHANNELS = {
  SE: 'C06CS5Q4L8G',
  'Platform-frontend': 'C06B5J3KD8F',
  'Platform-backend': 'C06C8TLTURE',
  gitAny: 'C06CMAY8066',
  deploy: 'C06CMU2S6JY',
};

const SLACK_CONFIG = {
  SKIP_USERS: ['john (이주호)'],
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

const REVIEW_STATES = {
  AWAITING: 'AWAITING',
  COMMENTED: 'COMMENTED',
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
};

const JOB_STATUS = {
  SUCCESS: 'success',
  FAILURE: 'failure',
};

module.exports = {
  GITHUB_CONFIG,
  SLACK_CHANNELS,
  SLACK_CONFIG,
  REVIEW_STATES,
  JOB_STATUS,
};
