# MyGuru SPM launch audit — 2026-11-02

## Verified live

- Supabase SPM backend is restored. PJY Booking backend is paused at the owner's request.
- All 12 subjects create fixed daily sets of 20 questions. Active responses conceal answers. Student access to teacher management is rejected.
- Direct browser access cannot read question answers, edit account roles/streaks or read other profiles.
- Submission is one database transaction. Of 20 simultaneous submissions to one attempt, one succeeds and 19 return conflict; saved answers match the score.
- Selection considers daily and practice history. The 76 published Biology questions were exhausted before repetition; least-used questions are preferred afterward.
- Twenty simultaneous starts produce one complete attempt. Valid unfinished practice resumes. Incomplete attempts or attempts containing withdrawn questions are skipped.
- Four verified MRSM Biology figures were recropped and stored privately. Browser mobile inspection confirmed loaded images and no horizontal overflow at 390 px.

## 100-student bounded capacity test

Run: `capacity-1793593808395`, against production deployment `dpl_FLuGKm9bYqErF4rcZHYW9zD9rHN8`.

Each stage issued 100 simultaneous operations using 100 distinct temporary student accounts across all 12 subjects. Account preparation was paced to respect authentication limits. Every generated account was deleted afterward.

| Stage | Failures | Median | 95th percentile | Maximum |
| --- | ---: | ---: | ---: | ---: |
| HTTP start daily | 0/100 | 2641 ms | 2781 ms | 2796 ms |
| HTTP load active questions | 0/100 | 1061 ms | 2240 ms | 2321 ms |
| Database scoring RPC | 0/100 | 998 ms | 1099 ms | 1119 ms |
| HTTP load scored results | 0/100 | 1065 ms | 1192 ms | 1274 ms |
| Database duplicate rejection RPC | 0/100 | 380 ms | 826 ms | 851 ms |

Scope: HTTP start/read/result and production database scoring. This excludes Google OAuth UI, browser rendering, HTTP submission throughput and Google Sheet background synchronization. It does not establish 300-student end-to-end capacity or sustained capacity over a whole lesson.

The initial account-preparation attempt hit Auth HTTP 429 before exercising the site; all 39 created accounts were removed. The successful preparation used paced sign-ins rather than changing security settings.

## Remaining work and limits

- Run `capacity-1793594118288` completed with 300 distinct students and zero failures in all five stages. All 300 accounts were deleted. P95: HTTP start 4169 ms; HTTP active questions 3657 ms; database scoring 1740 ms; HTTP results 3636 ms; duplicate rejection 1296 ms. Maximum HTTP result time was 5034 ms. Scope exclusions match the 100-student test above.
- The durable queue worker is deployed in `dpl_2hsuyPv859qE9BM5rvgURAYn2T5A` (READY). Submission and profile changes increment a pending version in their database transaction. A minute-based database cron job calls the authenticated worker only when work is due. An exclusive 180-second lease and 60-second cooldown prevent overlapping snapshot writers; failed work remains pending with bounded backoff. Browser roles cannot read queue state or execute queue RPCs. Secrets are stored only in production environment variables and Supabase Vault.
- Actual provider evidence: cron's first HTTP response was 200; the worker acknowledged version 5 after awaited Sheet writes. After HTTP test cleanup, requested and synced versions both reached 10 with zero failures at 04:52:02 UTC. The dashboard synchronization timestamp advanced to 12:52:01 Malaysia time; daily count 1 and correct total 17 matched database aggregates. Bounded searches of student-name rows found neither capacity-test nor HTTP-test accounts after that cleanup.
- Live HTTP submission test: 20 simultaneous PATCH requests yielded one 200 and nineteen 409 responses in 1179 ms; score 13 and streak 1 matched stored results. A practice submission scored 13 without altering the daily score. Both submissions requested durable synchronization. The generated test account was removed successfully through Auth after the new profile trigger was installed.
- Outstanding capacity scope: run `capacity-1793595204496` is currently preparing 300 accounts for HTTP submissions with the queue enabled. Follow its existing process/report instead of restarting it. OAuth browser login, client rendering and a sustained classroom-length test remain outside the measured scope. Temporary accounts may appear in the workbook during preparation; verify automatic resynchronization after their final cleanup.
- Pagination beyond 1000 users/attempts, worksheet expansion and zero-score display have 1500-student/30000-item mocked-provider coverage. That large-volume provider payload has not been written to the real administrative workbook.
- 24 legacy Biology questions and 9 Physics questions with missing diagrams/placeholders remain drafts. Restore only from verified original source files; do not fabricate missing diagrams.
- GitHub upload is blocked by connector permission and unavailable CLI authentication. Production fixes were released through the authenticated Vercel deployment API; local commits preserve the source changes.
- Database security advisor warns that leaked-password protection is disabled. The student UI uses Google login; no password configuration was changed.

## Repeatable verification

- `npm test` — 21 tests currently pass, including actual route handlers, queue worker behavior and paginated Sheet mock-provider writes.
- `npm run lint`
- `npx next typegen` then `npx tsc --noEmit` — regenerate Next route types after the vinext build before type checking.
- `node --env-file=.env.local scripts/smoke-production-quiz.mjs`
- `node --env-file=.env.local scripts/verify-atomic-submission.mjs`
- `node --env-file=.env.local scripts/verify-quiz-selection.mjs`
- `node --env-file=.env.local scripts/check-concurrent-students.mjs 100`
- `node --env-file=.env.local scripts/check-concurrent-students.mjs 300 --http-submit`
- `node --env-file=.env.local scripts/verify-http-submission.mjs`
- `tests/sheet-queue.sql` — live database state-machine assertions inside a transaction that rolls back; no provider calls.

Capacity tests use temporary accounts and clean up only those accounts. Recovery manifests contain generated UUIDs only. Do not commit credentials or test access tokens.
