async function getGithubNickNameToGitHub(octokit, githubName) {
  const res = await octokit.rest.users.getByUsername({
    username: githubName,
  });
  return res.data.name;
}

module.exports = getGithubNickNameToGitHub;
