declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    AUCTION_ADMIN_EMAIL?: string;
    AUCTION_PRIVATE_UPDATER?: string;
    AUCTION_BANK_NAME?: string;
    AUCTION_BANK_CLABE?: string;
    AUCTION_BANK_BENEFICIARY?: string;
    BUCKET?: R2Bucket;
  }
}
