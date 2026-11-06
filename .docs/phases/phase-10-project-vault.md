# Post-release feature: Project Vault (in development)

## Decision PV-D01: Explicit Project Lead approvals

Project resources remain company-readable, but vault resources MUST NOT inherit company-wide visibility. A Project Lead is automatically authorized. Every non-Lead Project Member requires explicit approval from the Project Lead, regardless of \`CAN_VIEW\` or \`CAN_EDIT\` access.

A self-joined Outcome creates a Project Member row and MUST NOT create an approved Vault grant. Approval is checked against the current Project Member row's \`createdAt\` so an approval from an earlier assignment cannot be reused after leaving and rejoining. Deactivated members cannot access the vault.

The Lead may approve or revoke an active Project Member. \`CAN_VIEW\` can read/reveal/download, \`CAN_EDIT\` can also create/update/delete. Archived project vaults are read-only. Only the Lead may manage approvals.

## Decision PV-D02: Server-managed authenticated encryption

The current MVP encrypts at the NestJS boundary using AES-256-GCM. A unique 96-bit nonce protects each version, and the AAD binds project ID, item ID, and version number. Ciphertext, tag, nonce, key version, and byte count are stored in PostgreSQL; no plaintext payload is persisted.

\`VAULT_ENCRYPTION_KEY\` is server-only and must be a 32-byte base64 key stored in a secrets manager or protected deployment environment. No key means reveal/create/update operations fail closed with 503. Existing encrypted data cannot be recovered if the encryption key is lost; establish an encrypted backup and future key-rotation process before production use. This is **not zero-knowledge end-to-end encryption**.

Small uploads (up to 256 KiB) are supported as base64 content through the JSON API; the NestJS JSON body limit is 512 KiB. Future large-file support needs a separate encrypted object-storage design. The version history is immutable and soft-deletion hides current items while retaining encrypted historical data.

## Decision PV-D03: Audit and UI safety

A dedicated audit table records grant approvals/revocations, creates, updates, deletes, reveals, and downloads. No plaintext is logged. Vault metadata stays in a separate endpoint; revealing/decrypting requires an explicit POST and is never performed when listing entries. Vault responses are private/no-store.

The React tab is shown to Leads and Project Members. Unauthorized members see an approval-needed screen; they cannot enumerate item metadata. React Query stores only nonsecret metadata; decrypted values are transient local state and cleared when switching items or closing the panel. Browser clipboard access is an explicit user gesture and cannot be revoked after copying.

## Deployment / acceptance

1. Configure the production Vault encryption key and verify backup/recovery procedures.
2. Apply \`prisma/migrations/20261106190000_project_vault\` before deploying the feature.
3. Regenerate Prisma client, validate schema, and run the repository verification suite.
4. Check authorization for Lead, approved/revoked/self-joined members, archived projects, and deactivated accounts.
5. Test AES-GCM tampering, cross-project ID isolation, payload limits, and secret leakage in logs.
6. Review the Project Vault UI against the latest Figma design before release.

Unresolved production hardening: managed KMS/envelope encryption and rotation, additional request throttling, sensitive-output masking for text previews, immutable audit retention, automatic secret-rotation reminders, operational migration verification, real browser/E2E coverage, and an explicit long-term vault deletion/retention policy.
