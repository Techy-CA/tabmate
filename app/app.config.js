// Extends app.json. The only dynamic part: Android push needs Firebase's
// google-services.json baked into the build. Locally it's picked up from
// ./google-services.json; on EAS, upload it as a file environment variable
// named GOOGLE_SERVICES_JSON (it's git-ignored, so EAS wouldn't see it
// otherwise). Without it the app still builds and runs — in-app realtime
// notifications work, only device push is unavailable.
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  const localFile = path.join(__dirname, "google-services.json");
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(localFile) ? "./google-services.json" : undefined);

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
