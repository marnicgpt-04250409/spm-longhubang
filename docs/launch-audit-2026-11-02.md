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

- 300-student capacity remains unverified.
- Sheet synchronization currently rebuilds the workbook for every successful submission. Concurrent writers, request quotas and retry behavior need further work before claiming full submission capacity.
- Local fixes and tests cover pagination beyond 1000 users/attempts, automatic worksheet expansion, and correct display of zero scores. Provider writes still require live verification after deployment.
- 24 legacy Biology questions and 9 Physics questions with missing diagrams/placeholders remain drafts. Restore only from verified original source files; do not fabricate missing diagrams.
- GitHub upload is blocked by connector permission and unavailable CLI authentication. Production fixes were released through the authenticated Vercel deployment API; local commits preserve the source changes.
- Database security advisor warns that leaked-password protection is disabled. The student UI uses Google login; no password configuration was changed.

## Repeatable verification

- `npm test` — 18 tests currently pass, including actual route handlers and paginated Sheet mock-provider writes.
- `npm run lint`
- `npx next typegen` then `npx tsc --noEmit` — regenerate Next route types after the vinext build before type checking.
- `node --env-file=.env.local scripts/smoke-production-quiz.mjs`
- `node --env-file=.env.local scripts/verify-atomic-submission.mjs`
- `node --env-file=.env.local scripts/verify-quiz-selection.mjs`
- `node --env-file=.env.local scripts/check-concurrent-students.mjs 100`

Capacity tests use temporary accounts and clean up only those accounts. Recovery manifests contain generated UUIDs only. Do not commit credentials or test access tokens.
