const { SLACK_CONFIG } = require('../constants');

/**
 * Normalizes a name by removing whitespace and parenthetical suffixes.
 * @param {string} rawName - The raw name to normalize.
 * @returns {string} The normalized name in lowercase.
 */
function normalizeName(rawName = '') {
  return rawName
    .trim()
    .replace(/\s*\(.*?\)$/, '') // Remove trailing parentheses
    .toLowerCase();
}

/**
 * Finds a specific property of a Slack user by matching names.
 * @param {Array} slackMembers - The list of Slack users.
 * @param {string} searchName - The name to search for.
 * @param {string} property - The property to retrieve ('id' or 'realName').
 * @returns {string} The requested property value or searchName if not found.
 */
function findSlackUserProperty(slackMembers, searchName, property) {
  const targetName = normalizeName(searchName);

  const user = slackMembers.find(({ real_name: realName, profile, deleted }) => {
    if (deleted) return false;

    const nameToCheck = [realName, profile.display_name].map((name) => name?.toLowerCase());
    const isSkipUser = nameToCheck.some(
      (name) => SLACK_CONFIG.SKIP_USERS.some((skipName) => name?.includes(skipName)),
    );

    if (isSkipUser) return false;

    return nameToCheck.some((sourceName) => {
      if (!sourceName) return false;
      return sourceName.includes(targetName) || targetName.includes(sourceName);
    });
  });

  if (!user) return searchName;

  const propertyMap = {
    id: () => user.id,
    realName: () => user.profile.display_name,
  };

  return propertyMap[property] ? propertyMap[property]() : searchName;
}

module.exports = {
  normalizeName,
  findSlackUserProperty,
};
