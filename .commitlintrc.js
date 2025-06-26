module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore', 'ci', 'build', 'revert'],
    ],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'subject-max-length': [2, 'always', 100],
    // Allow longer lines in release commits (semantic-release generates long changelog entries)
    'body-max-line-length': [0, 'always', 100], // Disable body line length limit
  },
  // Ignore release commits made by semantic-release
  ignores: [(message) => /^chore\(release\):/.test(message)],
}
