export type ConnectedInstagramProfile = {
  id?: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followers: number;
  following: number;
  mediaCount: number;
  profileUrl: string;
  connectedAt: string;
};

export function instagramEnv() {
  return {
    appId: process.env.INSTAGRAM_APP_ID || process.env.IG_APP_ID || "",
    appSecret:
      process.env.INSTAGRAM_APP_SECRET || process.env.IG_APP_SECRET || "",
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI || "",
    apiVersion: process.env.INSTAGRAM_API_VERSION || "v21.0",
    scopes:
      process.env.INSTAGRAM_SCOPES ||
      "instagram_business_basic,instagram_business_manage_insights,instagram_business_manage_comments",
  };
}

export function missingInstagramEnv() {
  const env = instagramEnv();
  return [
    ["INSTAGRAM_APP_ID", env.appId],
    ["INSTAGRAM_APP_SECRET", env.appSecret],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

export function cleanInstagramUsername(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "")
    .trim();
}

export function profileCookieValue(profile: ConnectedInstagramProfile) {
  return Buffer.from(JSON.stringify(profile), "utf8").toString("base64url");
}

export function parseProfileCookie(value?: string) {
  if (!value) return null;

  try {
    return JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    ) as ConnectedInstagramProfile;
  } catch {
    return null;
  }
}
