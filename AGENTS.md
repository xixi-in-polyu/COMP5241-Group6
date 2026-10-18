## Git Workflow & Commit Conventions

All contributors, including AI coding agents, must follow these Git collaboration rules.

### 1. Branch Management

- `main` is the protected, stable branch. Never commit or push directly to `main`.
- Create a separate branch for each feature, bug fix, or maintenance task.
- Follow these branch naming conventions:
  - `feature/<description>` — New features
  - `fix/<description>` — Bug fixes
  - `refactor/<description>` — Code restructuring
  - `docs/<description>` — Documentation updates
- Use lowercase kebab-case for branch names.
- Keep branches focused and short-lived.

### 2. Commit Message Convention

Follow the Conventional Commits specification:

`<type>(<optional-scope>): <short-description>`

Allowed types:

| Type | Purpose |
|---|---|
| `feat` | Introduce a new feature |
| `fix` | Fix a bug |
| `refactor` | Restructure code without changing behavior |
| `docs` | Update documentation |
| `test` | Add or modify tests |
| `chore` | Maintenance, dependencies, or configuration |
| `style` | Formatting changes without logic modifications |
| `perf` | Performance improvements |
| `ci` | CI/CD configuration changes |

Rules:
- Write commit messages in English.
- Use imperative mood and lowercase descriptions.
- Keep the subject concise, preferably under 72 characters.
- Each commit should represent one logical change.
- Avoid vague messages such as `update`, `fix bug`, or `changes`.

Examples:
- `feat(auth): add user login`
- `fix(course): resolve enrollment validation error`
- `refactor(chatbot): extract prompt builder`
- `docs: update setup instructions`
- `chore: update dependencies`

### 3. Pull Request Workflow

- Push feature branches to GitHub and create a Pull Request targeting `main`.
- Provide a concise description of the changes and testing performed.
- Keep PRs reasonably small and focused.
- Resolve merge conflicts before merging.
- At least one other team member should review the PR.
- Ensure relevant tests and CI checks pass before merging.
- Prefer Squash Merge for feature branches.

### 4. Synchronization & Conflict Prevention

- Synchronize with the latest `main` before starting new work.
- Avoid unrelated modifications outside the assigned task.
- Coordinate changes to shared files, dependencies, and database schemas.
- Never overwrite another contributor's changes to resolve conflicts.
- Do not rewrite shared branch history.

### 5. AI Agent Git Safety Rules

AI coding agents must follow these additional restrictions:

- Do not automatically commit, push, merge, or create PRs unless explicitly requested.
- Never execute `git push --force`, `git reset --hard`, or other destructive Git operations without explicit approval.
- Never switch branches or discard uncommitted changes without permission.
- Before committing, inspect `git status` and review the staged diff.
- Stage only files related to the requested task. Avoid `git add .` when unrelated changes exist.
- Do not modify or amend existing commits unless explicitly instructed.
- Never commit secrets, credentials, `.env` files, or generated build artifacts.
- When asked to commit, generate a message that follows the conventions above.