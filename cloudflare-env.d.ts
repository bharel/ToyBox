declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BLIZZARD_TOKEN_KEY?: string;
    TOYBOX_SITE_ORIGIN?: string;
    BUCKET?: R2Bucket;
  }
}
