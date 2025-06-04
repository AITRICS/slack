/**
 * Slack 메시지 구조 타입 정의
 * JSDoc을 통한 타입 힌트 제공
 */

/**
 * 작업 상태 타입
 * @typedef {'success'|'failure'|'cancelled'|'skipped'} JobStatus
 */

/**
 * 리뷰 상태 타입
 * @typedef {'AWAITING'|'COMMENTED'|'APPROVED'|'CHANGES_REQUESTED'|'DISMISSED'} ReviewState
 */

/**
 * 로그 레벨 타입
 * @typedef {'debug'|'info'|'warn'|'error'} LogLevel
 */

/**
 * 메시지 색상 타입
 * @typedef {'good'|'danger'|'warning'|'#439FE0'} MessageColor
 */

/**
 * 팀 슬러그 타입
 * @typedef {'SE'|'Platform-frontend'|'Platform-backend'} TeamSlug
 */

/**
 * Slack 채널 키 타입
 * @typedef {'SE'|'Platform-frontend'|'Platform-backend'|'gitAny'|'deploy'} SlackChannelKey
 */

/**
 * 액션 타입 리터럴
 * @typedef {'schedule'|'approve'|'comment'|'review_requested'|'changes_requested'|'deploy'|'ci'} ActionType
 */

/**
 * 핸들러 정보
 * @typedef {Object} HandlerInfo
 * @property {BaseEventHandler} handler - 이벤트 핸들러 인스턴스
 * @property {string} method - 호출할 메서드명
 */

/**
 * 핸들러 레지스트리 맵
 * @typedef {Map<ActionType, HandlerInfo>} HandlerRegistry
 */

/**
 * 이벤트 핸들러 서비스 의존성
 * @typedef {Object} EventHandlerServices
 * @property {import('../github/gitHubApiHelper')} gitHubApiHelper - GitHub API 헬퍼
 * @property {import('../slack/slackUserService')} slackUserService - Slack 사용자 서비스
 * @property {import('../slack/slackChannelService')} slackChannelService - Slack 채널 서비스
 * @property {import('../slack/slackMessageService')} slackMessageService - Slack 메시지 서비스
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
 * @typedef {Object} ActionConfig
 * @property {Object} action
 * @property {Object} action.deploy
 * @property {string} action.deploy.ec2Name
 * @property {string} action.deploy.imageTag
 * @property {string} action.deploy.jobStatus
 * @property {Object} action.ci
 * @property {string} action.ci.branchName
 * @property {string} action.ci.imageTag
 * @property {string} action.ci.jobName
 * @property {string} action.ci.jobStatus
 */

/**
 * GitHub 사용자 (확장된 버전)
 * @typedef {Object} GitHubUser
 * @property {string} login - GitHub 사용자명
 * @property {string} [name] - 실제 이름
 * @property {number} id - 사용자 ID
 * @property {string} html_url - 프로필 URL
 * @property {string} avatar_url - 아바타 URL
 * @property {string} events_url - 이벤트 URL
 * @property {string} followers_url - 팔로워 URL
 * @property {string} following_url - 팔로잉 URL
 * @property {string} gists_url - Gist URL
 * @property {string} gravatar_id - Gravatar ID
 * @property {string} node_id - 노드 ID
 * @property {string} organizations_url - 조직 URL
 * @property {string} received_events_url - 받은 이벤트 URL
 * @property {string} repos_url - 저장소 URL
 * @property {boolean} site_admin - 사이트 관리자 여부
 * @property {string} starred_url - 스타 URL
 * @property {string} subscriptions_url - 구독 URL
 * @property {string} type - 사용자 타입
 * @property {string} url - API URL
 * @property {string} user_view_type - 사용자 뷰 타입
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

/**
 * GitHub 커밋 정보
 * @typedef {Object} GitHubCommit
 * @property {Object} author - 작성자 정보
 * @property {Object} committer - 커미터 정보
 * @property {boolean} distinct - 고유 커밋 여부
 * @property {string} id - 커밋 ID (SHA)
 * @property {string} message - 커밋 메시지
 * @property {string} timestamp - 커밋 시간
 * @property {string} tree_id - 트리 ID
 * @property {string} url - 커밋 URL
 */

/**
 * GitHub 조직 정보
 * @typedef {Object} GitHubOrganization
 * @property {string} avatar_url - 아바타 URL
 * @property {string} description - 설명
 * @property {string} events_url - 이벤트 URL
 * @property {string} hooks_url - 훅 URL
 * @property {number} id - 조직 ID
 * @property {string} issues_url - 이슈 URL
 * @property {string} login - 로그인명
 * @property {string} members_url - 멤버 URL
 * @property {string} node_id - 노드 ID
 * @property {string} public_members_url - 공개 멤버 URL
 * @property {string} repos_url - 저장소 URL
 * @property {string} url - 조직 URL
 */

/**
 * GitHub Push 이벤트 페이로드
 * @typedef {Object} GitHubPushPayload
 * @property {string} after - 이후 커밋 SHA
 * @property {string|null} base_ref - 베이스 참조
 * @property {string} before - 이전 커밋 SHA
 * @property {GitHubCommit[]} commits - 커밋 목록
 * @property {string} compare - 비교 URL
 * @property {boolean} created - 생성 여부
 * @property {boolean} deleted - 삭제 여부
 * @property {boolean} forced - 강제 푸시 여부
 * @property {GitHubCommit} head_commit - 헤드 커밋
 * @property {GitHubOrganization} organization - 조직 정보
 * @property {GitHubRepository} repository - 저장소 정보
 */

/**
 * GitHub Actions Context 객체
 * @typedef {Object} GitHubContext
 * @property {GitHubPushPayload|Object} payload - GitHub webhook 페이로드
 * @property {GitHubUser} sender - 이벤트 발송자
 * @property {string} eventName - 이벤트 이름 (예: 'push')
 * @property {string} sha - 커밋 SHA
 * @property {string} ref - Git 참조 (예: 'refs/heads/branch-name')
 * @property {string} workflow - 워크플로우 이름
 * @property {string} action - 액션 이름
 * @property {string} actor - 실행한 사용자명
 * @property {string} job - 작업 이름
 * @property {number} runNumber - 실행 번호
 * @property {number} runId - 워크플로우 실행 ID
 * @property {string} apiUrl - GitHub API URL
 * @property {string} serverUrl - GitHub 서버 URL
 * @property {string} graphqlUrl - GitHub GraphQL URL
 */

/**
 * GitHub 저장소 정보 (확장된 버전)
 * @typedef {Object} GitHubRepository
 * @property {string} name - 저장소 이름
 * @property {string} full_name - 전체 저장소 이름
 * @property {string} html_url - 저장소 URL
 * @property {string} keys_url - 키 URL
 * @property {string} labels_url - 라벨 URL
 * @property {string} language - 주 언어
 * @property {string} languages_url - 언어 URL
 * @property {string|null} license - 라이선스
 * @property {string} master_branch - 기본 브랜치
 * @property {string} merges_url - 머지 URL
 * @property {string} milestones_url - 마일스톤 URL
 * @property {string|null} mirror_url - 미러 URL
 * @property {string} node_id - 노드 ID
 * @property {string} notifications_url - 알림 URL
 * @property {number} open_issues - 열린 이슈 수
 * @property {number} open_issues_count - 열린 이슈 개수
 * @property {string} organization - 조직명
 * @property {GitHubUser} owner - 소유자
 * @property {boolean} private - 비공개 여부
 * @property {string} pulls_url - PR URL
 * @property {number} pushed_at - 마지막 푸시 시간
 * @property {string} releases_url - 릴리스 URL
 * @property {number} size - 저장소 크기
 * @property {string} ssh_url - SSH URL
 * @property {number} stargazers - 스타 수
 * @property {number} stargazers_count - 스타 개수
 * @property {string} stargazers_url - 스타 URL
 * @property {string} statuses_url - 상태 URL
 * @property {string} subscribers_url - 구독자 URL
 * @property {string} subscription_url - 구독 URL
 * @property {string} svn_url - SVN URL
 * @property {string} tags_url - 태그 URL
 * @property {string} teams_url - 팀 URL
 * @property {string[]} topics - 토픽 목록
 * @property {string} trees_url - 트리 URL
 * @property {string} updated_at - 업데이트 시간
 * @property {string} url - API URL
 * @property {string} visibility - 가시성 ('private'|'public')
 * @property {number} watchers - 워처 수
 * @property {number} watchers_count - 워처 개수
 * @property {boolean} web_commit_signoff_required - 웹 커밋 서명 필요 여부
 */

/**
 * 배포 데이터 준비 결과
 * @typedef {Object} PreparedDeployData
 * @property {string} ec2Name - EC2 인스턴스 이름
 * @property {string} imageTag - 이미지 태그
 * @property {Object} repoData - 저장소 정보
 * @property {string} repoData.name - 저장소 이름
 * @property {string} repoData.url - 저장소 URL
 * @property {string} ref - Git 참조
 * @property {string} sha - 커밋 SHA
 * @property {string} status - 작업 상태
 * @property {boolean} isSuccess - 성공 여부
 * @property {string} totalRunTime - 전체 실행 시간
 * @property {string} triggerUser - 트리거한 사용자
 * @property {GitHubWorkflowRun} workflowData - 워크플로우 데이터
 */

/**
 * 빌드 데이터 준비 결과
 * @typedef {Object} PreparedBuildData
 * @property {string} branchName - 브랜치 이름
 * @property {string[]} jobNames - 작업 이름 목록
 * @property {string} imageTag - 이미지 태그
 * @property {Object} repoData - 저장소 정보
 * @property {string} repoData.name - 저장소 이름
 * @property {string} repoData.url - 저장소 URL
 * @property {string} sha - 커밋 SHA
 * @property {string} status - 작업 상태
 * @property {boolean} isSuccess - 성공 여부
 * @property {string} totalRunTime - 전체 실행 시간
 * @property {string} triggerUser - 트리거한 사용자
 * @property {GitHubWorkflowRun} workflowData - 워크플로우 데이터
 */

/**
 * 팀별 PR 그룹
 * @typedef {Object<string, GitHubPullRequest[]>} TeamGroupedPRs
 */

/**
 * 채널별 수신자 그룹
 * @typedef {Object<string, UserMappingResult[]>} ChannelGroupedRecipients
 */

/**
 * 알림 기본 데이터
 * @typedef {Object} BaseNotificationData
 * @property {string} prUrl - PR URL
 * @property {string} prTitle - PR 제목
 * @property {string} authorGithubUsername - 작성자 GitHub 사용자명
 * @property {string} targetGithubUsername - 대상 GitHub 사용자명
 */

/**
 * 승인 알림 데이터
 * @typedef {Object} ApprovalNotificationData
 * @property {string} commentUrl - 코멘트 URL
 * @property {string} commentBody - 코멘트 내용
 * @property {string} prUrl - PR URL
 * @property {string} prTitle - PR 제목
 * @property {string} targetGithubUsername - 대상 GitHub 사용자명 (PR 작성자)
 * @property {string} authorGithubUsername - 작성자 GitHub 사용자명 (리뷰어)
 */

/**
 * 리뷰 요청 알림 데이터
 * @typedef {Object} ReviewRequestNotificationData
 * @property {string} prUrl - PR URL
 * @property {string} prTitle - PR 제목
 * @property {string} targetGithubUsername - 대상 GitHub 사용자명 (PR 작성자)
 * @property {string} reviewerGithubUsername - 리뷰어 GitHub 사용자명
 */

/**
 * Slack 데이터 보강 결과
 * @typedef {Object} EnrichedSlackData
 * @property {string} targetSlackId - 대상 Slack ID
 * @property {string} authorSlackName - 작성자 Slack 이름
 */

/**
 * 확장된 PR 정보
 * @typedef {GitHubPullRequest & Object} EnrichedPullRequest
 * @property {string} reviewersStatusString - 리뷰어 상태 문자열
 * @property {string|null} teamSlug - 팀 슬러그
 */

/**
 * 포맷된 메시지 결과
 * @typedef {Object} FormattedMessageResult
 * @property {string} text - 메시지 텍스트
 * @property {SlackAttachment} attachment - 첨부 내용
 */

/**
 * 예약된 리뷰 메시지 데이터
 * @typedef {Object} ScheduledReviewMessageData
 * @property {string} prUrl - PR URL
 * @property {string} prTitle - PR 제목
 * @property {string} body - 메시지 본문
 * @property {string} [targetGithubUsername] - 대상 GitHub 사용자명
 */

/**
 * 이미지 처리 결과
 * @typedef {Object} ImageProcessResult
 * @property {string} text - 이미지 처리된 텍스트
 * @property {Object[]} imageAttachments - Slack 이미지 첨부
 * @property {boolean} hasImages - 이미지 포함 여부
 */

/**
 * 확장된 알림 데이터 (이미지 지원)
 * @typedef {NotificationData & Object} EnhancedNotificationData
 * @property {Object[]} [imageAttachments] - 이미지 첨부
 * @property {boolean} [hasImages] - 이미지 포함 여부
 */

module.exports = {};
