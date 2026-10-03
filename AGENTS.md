# Project agent instructions

These instructions apply throughout this repository, including `portal/`.
Also follow any applicable instructions in child directories.

## Commit each completed feature

- The user authorizes local Git commits as part of implementation. After completing each feature, bug fix, or other requested change (including documentation), verify it and create a focused commit before reporting completion or starting the next independent feature. Do not wait for the user to remind you or ask for routine commit confirmation.
- At the start of work, inspect `git status` and relevant staged and unstaged diffs so you can distinguish existing work from your own changes.
- Run the checks appropriate to the change and inspect the intended commit diff. Fix failures caused by your work before committing. If verification is blocked or a failure is pre-existing, clearly report the limitation; do not claim checks passed.
- Commit only the files or hunks belonging to the completed task. Preserve unrelated changes, including already staged work. Avoid blanket `git add .`, `git add -A`, or committing the entire index without reviewing its contents. Use selective staging and an isolated commit/index when needed; if overlapping work cannot be safely separated, report the blocker rather than bundling it silently.
- Use a clear commit message describing the result, such as `feat: add monthly payroll export`, `fix: correct leave balance calculation`, or `docs: clarify setup steps`.
- After committing, verify the commit contents and Git status. Ensure no intended changes from the completed task were accidentally left uncommitted; unrelated changes may remain.
- In the final response, include the short commit hash, a brief description, and the verification result. If no commit was created, explicitly explain why (for example, no file changes, an explicit user request not to commit, or a Git blocker). Never claim a commit succeeded without checking.
- This authorization covers local commits only. Push, amend, history rewriting, and destructive Git operations require separate authorization. Do not commit secrets or incidental generated files.

Completion means: requested change implemented, appropriate verification performed, and a local commit created, unless the user explicitly directs otherwise or a concrete blocker is reported.
