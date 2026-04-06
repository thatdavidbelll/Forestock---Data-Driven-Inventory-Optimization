# Contributing to Forestock

## Local Setup

See [README.md](README.md) for prerequisites and setup instructions.

## Branch Naming

- `feature/<description>` for new features
- `fix/<description>` for bug fixes
- `chore/<description>` for maintenance tasks

## Pull Request Process

1. Create a feature branch from `main`.
2. Ensure `./mvnw test` passes (backend) and `npm run lint` passes (frontend).
3. Open a PR against `main` with a clear description of changes.
4. PRs require at least one review before merging.

## Commit Messages

Use concise, imperative mood: "Add inventory export", "Fix forecast calculation for zero-stock items".
