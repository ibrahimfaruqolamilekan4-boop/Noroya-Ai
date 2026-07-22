# Security Specification & "Dirty Dozen" Hardening Plan

This document defines the Attribute-Based Access Control (ABAC) invariants and security payload tests for the **Synthetic SMC Analytica** Firebase integration.

## 1. Data Invariants
1. **Authenticated Owner Access**: A user can only create, read, update, or delete trade documents where `userId` strictly matches their own `request.auth.uid`. No user can read other users' metrics or logs.
2. **Immutable Traceability**: Once a trade log is inserted, the `userId` and `created_at` fields must remain completely immutable on updates.
3. **Type and Magnitude Boundaries**: Numeric parameters (`entry_price`, `stop_loss`, `take_profit`) must be strictly positive numbers.
4. **Valid States**: The `status` field must be limited strictly to `PENDING`, `WON`, `LOST`, or `BREAKEAVEN`.
5. **No Spoofing or Orphaned Profiling**: All requests require active authenticated sessions. Anonymous or unverified claims must be rejected.

---

## 2. The "Dirty Dozen" Adversarial Payloads
Below are 12 specific hostile payloads trying to bypass rules. Our security rules will return `PERMISSION_DENIED` on all of them.

### [Attack 1] The Identity Hijacker (Creating for someone else)
* **Goal**: Attackers trying to insert a trade log claiming someone else's UID to spoof performance records.
* **Payload**:
```json
{
  "userId": "victim_user_uid_12345",
  "symbol": "V75",
  "timeframe": "H1",
  "bias": "BULLISH",
  "entry_price": 1500.0,
  "stop_loss": 1480.0,
  "take_profit": 1550.0,
  "status": "PENDING",
  "created_at": "2026-06-11T08:51:24Z"
}
```
* **Reason for Reject**: `request.auth.uid != incoming().userId`.

### [Attack 2] The Anonymous Spammer
* **Goal**: Unauthenticated user trying to trigger a write operation on the `trades` collection.
* **Payload**: Any valid trade shape.
* **Reason for Reject**: `request.auth == null`.

### [Attack 3] The Ghost Fields Update (Bypassing properties list)
* **Goal**: Tampering with the database schema by appending arbitrary metadata tags (e.g. `isAdmin: true`).
* **Payload**:
```json
{
  "userId": "attacker_uid",
  "symbol": "V75",
  "timeframe": "H1",
  "bias": "BULLISH",
  "entry_price": 1500.0,
  "stop_loss": 1480.0,
  "take_profit": 1550.0,
  "status": "PENDING",
  "created_at": "2026-06-11T08:51:24Z",
  "hackerAdminCheck": true
}
```
* **Reason for Reject**: Strict key size and key validation helper enforcement.

### [Attack 4] Negative Pricing Poisoning
* **Goal**: Submitting malicious negative entries or zero-limits to break risk calculations.
* **Payload**:
```json
{
  "userId": "attacker_uid",
  "symbol": "V100",
  "timeframe": "H1",
  "bias": "BULLISH",
  "entry_price": -5200.0,
  "stop_loss": 1480.0,
  "take_profit": 1550.0,
  "status": "PENDING",
  "created_at": "2026-06-11T08:51:24Z"
}
```
* **Reason for Reject**: `incoming().entry_price > 0`.

### [Attack 5] The Out-of-Bounds Status injection
* **Goal**: Promoting a position to a fake or non-standard tier status (e.g., `LIQUIDATED` or `ADMIN_OVERRIDE`).
* **Payload**:
```json
{
  "userId": "attacker_uid",
  "status": "ADMIN_OVERRIDE_WON"
}
```
* **Reason for Reject**: `status` field is strictly matched using enum validation bounds in the schema helper.

### [Attack 6] Invalidation of Timestamp (Retroactive dates)
* **Goal**: Backdating or postdating transactions using client timestamps to inflate win history.
* **Payload**:
```json
{
  "userId": "attacker_uid",
  "created_at": "1999-01-01T00:00:00Z"
}
```
* **Reason for Reject**: `created_at` timestamp check rejects client times that deviate from `request.time`.

### [Attack 7] The Immutable Owner Hijack (Update Attack)
* **Goal**: Attempting to alter the ID of the owner of a trade after it is created.
* **Payload**:
```json
{
  "userId": "compromised_victim_uid"
}
```
* **Reason for Reject**: Rules require `incoming().userId == existing().userId`.

### [Attack 8] Long-payload Resource Exhaustion (Denial of Wallet)
* **Goal**: Injecting huge strings (e.g. 10MB) into the `symbol` or `timeframe` attributes to inflate Firestore bandwidth billing.
* **Payload**:
```json
{
  "userId": "attacker_uid",
  "symbol": "A_VERY_LONG_STRING_REPEATING_10000_TIMES_..."
}
```
* **Reason for Reject**: Character boundary checking `.size() <= 64` on string properties.

### [Attack 9] Invalidation of ID format (Path Injection)
* **Goal**: Forging a document path containing characters designed to trigger routing errors or injection (e.g. `/trades/../admins/attacker`).
* **Reason for Reject**: Validating document parameter variables using strict regex pattern checks prior to matching routing nodes.

### [Attack 10] Bypass Query Filtering (Unsecured Collection Read)
* **Goal**: Requesting all user trade history in a single list fetch without filter parameters.
* **Response**: Rejection unless specifying `userId == request.auth.uid` inside lists.

### [Attack 11] Spoilage of Immutable Inception Timestamp
* **Goal**: Re-setting the `created_at` timestamp during an update action.
* **Reaction**: Rejection because `incoming().created_at == existing().created_at`.

### [Attack 12] The PII Leak Attempt
* **Goal**: Scanning or reading another trader's custom screenshot payloads or logs.
* **Reaction**: Rejection since document `get` and `list` operations restrict entry to document-matched `userId`.
