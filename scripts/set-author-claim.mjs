#!/usr/bin/env node
/**
 * Grant yourself the authoring role (custom claim). Learners need no claim
 * (learning keys off authentication only).
 *
 * First, sign in once at /signin with Google so a real user (with your email)
 * exists. Then run with that email — or with your uid (from the Firebase
 * console > Authentication, or the /signin page footer).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *     node scripts/set-author-claim.mjs you@domain.com            # by email
 *   ... node scripts/set-author-claim.mjs --uid <uid>             # by uid
 *   ... node scripts/set-author-claim.mjs you@domain.com admin    # custom role
 *
 * Re-authenticate (sign out/in) afterward so the new token carries the claim.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const args = process.argv.slice(2);
const uidFlag = args.indexOf('--uid');
let user, role = 'content_curator';

initializeApp({ credential: applicationDefault() });
const auth = getAuth();

if (uidFlag !== -1) {
  const uid = args[uidFlag + 1];
  if (!uid) { console.error('Provide a uid after --uid'); process.exit(1); }
  if (args[uidFlag + 2]) role = args[uidFlag + 2];
  user = await auth.getUser(uid);
} else {
  const email = args[0];
  if (!email) { console.error('Usage: set-author-claim.mjs <email> [role]  |  --uid <uid> [role]'); process.exit(1); }
  if (args[1]) role = args[1];
  user = await auth.getUserByEmail(email);
}

await auth.setCustomUserClaims(user.uid, { role });
console.log(`Set role="${role}" for ${user.email || user.uid} (${user.uid}). Re-authenticate to refresh the token.`);
