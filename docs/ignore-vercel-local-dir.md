# Ignore local Vercel directory

This cleanup adds `.vercel/` to `.gitignore`.

Reason:
- `.vercel/` is generated locally by Vercel CLI/project linking.
- It should not be committed to the repository.
- The directory may contain local machine/project metadata.

No production code, deployment config, or runtime behavior is changed.
