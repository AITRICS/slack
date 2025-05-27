/**
 * Slack 메시지 구조 타입 정의
 * JSDoc을 통한 타입 힌트 제공
 */

/**
 * Slack 메시지 필드
 * @typedef {Object} SlackField
 * @property {string} title - 필드 제목
 * @property {string} value - 필드 값
 * @property {boolean} short - 짧은 필드 여부
 */

/**
 * Slack 첨부 파일
 * @typedef {Object} SlackAttachment
 * @property {string} color - 첨부 색상 ('good', 'warning', 'danger', '#hex')
 * @property {string} [text] - 첨부 텍스트
 * @property {SlackField[]} [fields] - 필드 목록
 * @property {string} [fallback] - 폴백 텍스트
 */

/**
 * Slack 메시지
 * @typedef {Object} SlackMessage
 * @property {string} [channel] - 채널 ID
 * @property {string} text - 메시지 텍스트
 * @property {SlackAttachment[]} [attachments] - 첨부 목록
 * @property {boolean} [mrkdwn] - 마크다운 사용 여부
 */

/**
 * Slack 사용자
 * @typedef {Object} SlackUser
 * @property {string} id - Slack 사용자 ID
 * @property {string} real_name - 실제 이름
 * @property {boolean} deleted - 삭제된 계정 여부
 * @property {Object} profile - 프로필 정보
 * @property {string} profile.display_name - 표시 이름
 */

/**
 * GitHub 사용자
 * @typedef {Object} GitHubUser
 * @property {string} login - GitHub 사용자명
 * @property {string} [name] - 실제 이름
 * @property {number} id - 사용자 ID
 * @property {string} html_url - 프로필 URL
 */

/**
 * GitHub PR
 * @typedef {Object} GitHubPullRequest
 * @property {number} number - PR 번호
 * @property {string} title - PR 제목
 * @property {string} html_url - PR URL
 * @property {GitHubUser} user - PR 작성자
 * @property {boolean} draft - 드래프트 여부
 * @property {GitHubUser[]} [requested_reviewers] - 요청된 리뷰어들
 */

/**
 * GitHub 코멘트
 * @typedef {Object} GitHubComment
 * @property {number} id - 코멘트 ID
 * @property {string} body - 코멘트 내용
 * @property {string} html_url - 코멘트 URL
 * @property {GitHubUser} user - 코멘트 작성자
 * @property {string} [diff_hunk] - 코드 스니펫
 * @property {number} [in_reply_to_id] - 답글 대상 코멘트 ID
 */

/**
 * GitHub 리뷰
 * @typedef {Object} GitHubReview
 * @property {number} id - 리뷰 ID
 * @property {string} state - 리뷰 상태
 * @property {string} body - 리뷰 내용
 * @property {string} html_url - 리뷰 URL
 * @property {GitHubUser} user - 리뷰어
 */

/**
 * GitHub 워크플로우 실행 정보
 * @typedef {Object} GitHubWorkflowRun
 * @property {string} name - 워크플로우 이름
 * @property {string} html_url - 워크플로우 URL
 * @property {string} run_started_at - 시작 시간
 * @property {GitHubUser} actor - 실행한 사용자
 */

/**
 * GitHub 저장소 정보
 * @typedef {Object} GitHubRepository
 * @property {string} name - 저장소 이름
 * @property {string} full_name - 전체 저장소 이름
 * @property {string} html_url - 저장소 URL
 */

/**
 * GitHub 이벤트 페이로드 - 코멘트
 * @typedef {Object} CommentPayload
 * @property {GitHubComment} comment - 코멘트 정보
 * @property {GitHubPullRequest} [pull_request] - PR 정보 (코드 코멘트)
 * @property {Object} [issue] - 이슈 정보 (PR 페이지 코멘트)
 * @property {GitHubRepository} repository - 저장소 정보
 */

/**
 * GitHub 이벤트 페이로드 - 리뷰
 * @typedef {Object} ReviewPayload
 * @property {GitHubReview} review - 리뷰 정보
 * @property {GitHubPullRequest} pull_request - PR 정보
 * @property {GitHubRepository} repository - 저장소 정보
 */

/**
 * 알림 데이터 (코멘트, 승인, 리뷰 요청용)
 * @typedef {Object} NotificationData
 * @property {string} prUrl - PR URL
 * @property {string} prTitle - PR 제목
 * @property {string} [commentUrl] - 코멘트 URL
 * @property {string} [commentBody] - 코멘트 내용
 * @property {string} [codeSnippet] - 코드 스니펫
 * @property {string} authorSlackName - 작성자 Slack 이름
 * @property {string} [targetSlackId] - 대상 Slack ID
 * @property {string} [mentionsString] - 멘션 문자열
 */

/**
 * 배포/빌드 알림 데이터
 * @typedef {Object} DeploymentData
 * @property {string} status - 상태 ('success', 'failure')
 * @property {string} repoUrl - 저장소 URL
 * @property {string} repoName - 저장소 이름
 * @property {string} [ec2Name] - EC2 인스턴스 이름 (배포용)
 * @property {string} [branchName] - 브랜치 이름 (빌드용)
 * @property {string} triggerUsername - 트리거한 사용자명
 * @property {string} sha - 커밋 SHA
 * @property {string} [imageTag] - 이미지 태그
 * @property {string} duration - 실행 시간
 * @property {string} workflowUrl - 워크플로우 URL
 * @property {string} workflowName - 워크플로우 이름
 * @property {string} [ref] - Git 참조 (배포용)
 * @property {string[]} [jobNames] - CI 작업 목록 (빌드용)
 */

/**
 * 사용자 매핑 결과
 * @typedef {Object} UserMappingResult
 * @property {string} githubUsername - GitHub 사용자명
 * @property {string} slackId - Slack 사용자 ID
 */

/**
 * @typedef {Object} CommentTypeInfo
 * @property {boolean} isCodeComment
 * @property {number} prNumber
 * @property {'pr_page'|'code_review'} commentType
 */

module.exports = {};