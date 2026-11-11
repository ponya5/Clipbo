/** Public details shown on the About screen. */
const AUTHOR_NAME = 'Daniel Shalom';
const GITHUB_PROFILE_URL = 'https://github.com/danielShalom';
const PROJECT_URL = `${GITHUB_PROFILE_URL}/clipbo`;

/** Only these links may be opened in the system browser. */
const ALLOWED_EXTERNAL_URLS = [GITHUB_PROFILE_URL, PROJECT_URL];

module.exports = { AUTHOR_NAME, GITHUB_PROFILE_URL, PROJECT_URL, ALLOWED_EXTERNAL_URLS };
