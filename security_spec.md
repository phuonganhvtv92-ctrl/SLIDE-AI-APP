# Security Specification (TDD) - AI PowerPoint Slide Generator

## 1. Data Invariants
- A **Presentation** document must belong to a authenticated lecturer/teacher.
- The `userId` of the presentation must exactly match the authenticated user's ID (`request.auth.uid`).
- The `createdAt` field must be set server-side synchronously using `request.time`.
- Document IDs must conform to alphanumeric characters and dash/underscore safely (`isValidId`).
- To prevent Denial of Wallet and Resource Poisoning:
  - `title` is limited to max 120 characters.
  - `themePreset` is limited to max 50 characters.
  - `slidesJson` string is limited to max 128KB characters.

## 2. The "Dirty Dozen" Privilege-Escalation Payloads
Below are 12 malicious payloads designed to bypass security and violate identity. The security rules will block all of these with `PERMISSION_DENIED`:

1. **Anonymous Read**: Unauthenticated request attempting to list all slides:
   `GET /databases/(default)/documents/presentations` => Should be REJECTED.
2. **Identity Spoofing on Create**: Authenticated user `attacker_uid` trying to insert a slide deck with `userId: "teacher_uid"`.=> Should be REJECTED.
3. **Identity Spoofing on Update**: Authenticated user `attacker_uid` trying to change another user's presentation `userId` or write onto it. => Should be REJECTED.
4. **Altering Immutable Creator Timestamp**: Trying to overwrite `createdAt` date on document update. => Should be REJECTED.
5. **Path Variable ID Poisoning**: Trying to create a presentation with an extremely long junk document ID e.g., representing 1MB of buffer values. => Should be REJECTED.
6. **Self-Elevating User Roles/Admin Spoofing**: Attempting to alter any system profile flags. => Should be REJECTED.
7. **Bypassing Character Size Limit on Title**: Title size of 50,000 characters to spam database memory. => Should be REJECTED.
8. **Malicious Empty Payload**: Creating a presentation with empty fields. => Should be REJECTED.
9. **Fake Server Time Injection**: Injecting a mock historic client timestamp in `createdAt` to mess with chronological integrity. => Should be REJECTED.
10. **Shadow Key Exploits**: Injecting a random ghost permission key e.g. `{ isAdmin: true }` in fields to trick dynamic mapping. => Should be REJECTED.
11. **Mass Unfiltered Search**: Sending structural queries without sorting by `userId == auth.uid` to scoop up other users' summaries. => Should be REJECTED.
12. **Tampering with the Slides Schema**: Inserting binary attachments or malicious script sequences inside `slidesJson`. => Should be REJECTED.

## 3. Threat Model Status Mapping
| Threat | Target Collection | Mitigation Pattern | Status |
|---|---|---|---|
| ID Injection / Poisoning | `presentations` | `isValidId` and size checking | Matched & Enforced |
| Identity Theft | `presentations` | `userId == request.auth.uid` validation | Matched & Enforced |
| Payload Abuse / Bloat | `presentations` | Key structural size checks | Matched & Enforced |
| Cross-User Leak | `presentations` | List rule mandates `resource.data.userId == currentUid` | Matched & Enforced |
