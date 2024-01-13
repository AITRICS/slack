# Slack Git Action V3

## About
이 액션은 다른 Github에서 발생되는 PR, Reviewer, Comment 등의 이벤트를 Slack으로 전송합니다.  
Slack으로 전송될 때, Reviewer나 PR owner의 경우 Github의 Profile name이랑 Mapping 시켜서 맨션을 걸도록 했습니다.  
Channel은 해당 Github user가 속해있는 Github member기준으로 나눠서 Slack channel과 Mapping 시켜서 전송하도록 했습니다.  
Handler code의 `GITHUB_TEAM_SLUGS`, `SLACK_CHANNEL` 을 기준으로 Mapping 시킵니다.

## Reference
- [Github Action](https://docs.github.com/en/actions/creating-actions)
- [Javascript Github Action](https://github.com/actions/javascript-action)
- [Slack web api](https://api.slack.com/methods)
- [Octokit](https://octokit.github.io/rest.js/v20)

## Develop Environment
- Node version :  20
- Lint : ESLint (airbnb-base)

## Function
### schedule
- 해당 기능은 한국시간 오전 9시에 한번 트리거 됩니다.
- 트리거 되면 현재 리뷰중인 PR이 Slack 으로 전송됩니다.
- 해당 Noti는 Reviewer가 맨션되도록 되어있습니다.

### approve
- 해당 기능은 PR이 Approve 되었을 때 트리거 됩니다.

### comment
- 해당 기능은 PR에 Comment가 달렸을 때 트리거 됩니다.
- Comment가 달리면 해당 PR의 owner혹은 Reviewer에게 Slack으로 전송됩니다.
- 마찬가지로 맨션되도록 되어있습니다.
- 대댓글이 달려도 Noti를 보냅니다.

### review_requested, changes_requested
- 해당 기능은 PR에 Reviewer가 추가되었을 때 트리거 됩니다.
- Reviewer가 추가되면 해당 Reviewer에게 Slack으로 전송됩니다.
- 마찬가지로 맨션되도록 되어있습니다.
- Reviewer가 PR을 보고 changes requested를 하면 해당 PR의 owner에게 Slack으로 전송됩니다.

### deploy
- 해당 기능은 `workflow_call` 로 트리거 할 수 있습니다.
- Gitaction을 통한 Deploy가 완료되면 Slack으로 전송됩니다.
- 채널은 `#1_rnd-git-deploy` 로 고정되어 있습니다.
- 성공/실패 여부, 얼마나 걸렸는지, 어느 EC2에 배포되었는지 등이 메시지로 전달됩니다.

## Inputs
>```
>SLACK_TOKEN
>GITHUB_TOKEN
>ACTION_TYPE
>```
위 3가지는 필수 요소 입니다. (Required)  
ACTION_TYPE에는 Function에서 설명한 기능들이 들어가야 합니다.
>```
>schedule
>approve
>comment
>review_requested
>changes_requested
>```

## Usage

### Schedule
```
  cron:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    steps:
      - uses: actions/checkout@v4
      - uses: aitrics/slack@v2
        with:
          SLACK_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.BOT_SECRET_KEY }}
          ACTION_TYPE: 'schedule'
```

### Approve
```
  approval-job:
    runs-on: ubuntu-latest
    if: github.event.review.state == 'approved'
    steps:
      - uses: actions/checkout@v4
      - uses: aitrics/slack@v2
        with:
          SLACK_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.BOT_SECRET_KEY }}
          ACTION_TYPE: 'approve'
```

### Comment
```
  issue_comment:
    if: github.event.issue.pull_request != null || github.event_name == 'pull_request_review_comment'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aitrics/slack@v2
        with:
          SLACK_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.BOT_SECRET_KEY }}
          ACTION_TYPE: 'comment'
```

### Review Requested
```
  reviewer-requested-job:
    runs-on: ubuntu-latest
    if: github.event.action == 'review_requested'
    steps:
      - uses: actions/checkout@v4
      - uses: aitrics/slack@v2
        with:
          SLACK_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.BOT_SECRET_KEY }}
          ACTION_TYPE: 'review_requested'
```

### Changes Requested
```
  request-changes-job:
    runs-on: ubuntu-latest
    if: github.event.review.state == 'changes_requested'
    steps:
      - uses: actions/checkout@v4
      - uses: aitrics/slack@v2
        with:
          SLACK_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.BOT_SECRET_KEY }}
          ACTION_TYPE: 'changes_requested'
```

### Deploy
```
on:
  workflow_call:
    inputs:
      ec2_name:
        type: string
      image_tag:
        type: string

  deploy:
    runs-on: ubuntu-latest
    if: github.event_name == 'workflow_dispatch'
    steps:
      - uses: actions/checkout@v4
      - uses: aitrics/slack@v2
        with:
          SLACK_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.BOT_SECRET_KEY }}
          ACTION_TYPE: 'deploy'
          EC2_NAME: ${{ inputs.ec2_name }}
          IMAGE_TAG: ${{ inputs.image_tag || github.sha }}
          JOB_STATUS: ${{ needs.echo-job.result || 'failure' }}
```

### Improvements
1. 현재 `GITHUB_TEAM_SLUGS`, `SLACK_CHANNEL`는 하드코딩 되어 있습니다.  
   지금은 Dev team에서만 사용하지만, 사용 범위가 점차 확장된다면 Input으로 받는 걸 고려 해야 합니다.
2. githubUtils.js 같은 경우 함수가 여러게 있습니다.  
   이 함수들을 Class로 묶을지의 여부는 고려할 만한 사항입니다.
3. Dev team에서 만든 CI/CD Git action의 Noti를 추가 개발해야 합니다.  
   성공/실패 여부, 얼마나 걸렸는지, 어느 EC2에 배포되었는지 등이 필요합니다.

### P.S
새로운 기능 개발, 개선, 버그 수정 등은 언제든지 환영입니다.  
편하게 PR 날려주세요.
