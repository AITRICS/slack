/**
 * Validation utility functions
 */
class Validator {
  static isValidGithubUsername(username) {
    return username && typeof username === 'string' && username.length > 0;
  }

  static isValidSlackProperty(property) {
    return ['id', 'realName'].includes(property);
  }

  static isValidPayload(payload) {
    return payload && typeof payload === 'object';
  }
}

module.exports = Validator;
