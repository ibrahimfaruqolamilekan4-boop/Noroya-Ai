# Security Specification & "Dirty Dozen" Hardening Plan

This document defines the Attribute-Based Access Control (ABAC) invariants and adversarial security test payloads for the **QuantSMC Scalp & Normal Trade Analyzer** Firebase Firestore integration across all 5 collections: `/trades`, `/chat_history`, `/user_learnings`, `/analysis_reports`, and `/user_preferences`.

## 1. Data Invariants & Relationship Mapping
1. **Master Ownership Gate**: Every document in `/trades`, `/chat_history`, `/user_learnings`, `/analysis_reports`, and `/user_preferences` belongs strictly to a single authenticated user (`userId == request.auth.uid`). No non-admin user can read, list, update, or delete another user's records.
2. **Verified Identity**: Standard write operations require an authenticated session with a verified email (`request.auth.token.email_verified == true`), matching Google Sign-In.
3. **Immutable Traceability**: On updates, `userId` and `created_at` are strictly immutable (`incoming().userId == existing().userId && incoming().created_at == existing().created_at`).
4. **Temporal Integrity**: Creation timestamps (`created_at`) and preference update timestamps (`updated_at`) MUST equal `request.time` (server timestamp). Client-forged dates are rejected.
5. **Anti-Update-Gap & Strict Key Allowlisting**: Every `create` checks both `keys().hasAll(...)` and `keys().hasOnly(...)`. Every `update` invokes `isValid[Entity](incoming())` first and uses `incoming().diff(existing()).affectedKeys().hasOnly([...])` (never `.hasAny`).
6. **Document Size & Denial-of-Wallet Bounds**: Every `string` enforces explicit `.size()` ceilings (`image_url <= 350000` bytes so documents never breach Firestore's 1MB limit), and every document ID path variable enforces `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, `<= 128` chars) on single-document operations (`get`, `create`, `update`, `delete`).
7. **Secure List Queries**: Every `allow list` checks `resource.data.userId == request.auth.uid || isAdmin()` with zero `get()`/`exists()` lookups inside list blocks. `/user_preferences` disallows `list` completely.

---

## 2. The "Dirty Dozen" Adversarial Payloads (Expected: `PERMISSION_DENIED`)

1. **Identity Hijack (`trades` create)**: Authenticated user `uid_A` creates a trade with `userId: "uid_B"`. Blocked by `data.userId == request.auth.uid`.
2. **Anonymous Write (`trades` / `analysis_reports` create)**: Unauthenticated request (`request.auth == null`). Blocked by `isVerifiedUser()`.
3. **Unverified Email Spoofing (Admin or User)**: Authenticated token with `email: "ibrahimfaruqolamilekan4@gmail.com"` and `email_verified: false`. Blocked by `request.auth.token.email_verified == true`.
4. **Shadow Field Injection on Create (`trades` create)**: Valid payload plus ghost key `isAdmin: true`. Blocked by `incoming().keys().hasOnly([...])`.
5. **Shadow Update Injection (`trades` update)**: Owner updates `notes` AND injects ghost key `verifiedPnl: true`. Blocked by `incoming().diff(existing()).affectedKeys().hasOnly([...])`.
6. **Negative Price Poisoning (`trades` create/update)**: Submitting `entry_price: -100` or `stop_loss: -5`. Blocked by `data.entry_price >= 0.0 && data.stop_loss >= 0.0`.
7. **Out-of-Bounds Status Enum (`trades` update)**: Submitting `status: "ADMIN_OVERRIDE"`. Blocked by `data.status in ['PENDING', 'WON', 'LOST', 'BREAKEAVEN']`.
8. **Retroactive Client Timestamp (`trades` / `analysis_reports` create)**: Submitting client ISO string or past timestamp for `created_at` instead of `serverTimestamp()`. Blocked by `incoming().created_at == request.time`.
9. **Immutable Owner / Timestamp Tampering (`trades` / `user_learnings` update)**: Modifying `userId` or `created_at` after creation. Blocked by `incoming().userId == existing().userId && incoming().created_at == existing().created_at`.
10. **Denial-of-Wallet Oversized String (`trades` / `chat_history` create)**: Submitting a 1MB `symbol` or 2MB `image_url`. Blocked by `data.symbol.size() <= 64` and `data.image_url.size() <= 350000`.
11. **Path Variable ID Poisoning (`trades/{tradeId}` get/create)**: Using a malformed or 500-char document ID containing spaces or special characters. Blocked by `isValidId(tradeId)`.
12. **Unfiltered Collection Scraping (`trades` / `analysis_reports` / `user_preferences` list)**: Non-admin querying all trades without `where('userId', '==', uid)` or attempting to `list` `/user_preferences`. Blocked by `allow list: if isSignedIn() && (resource.data.userId == request.auth.uid || isAdmin())` and `allow list: if false` on `/user_preferences`.
