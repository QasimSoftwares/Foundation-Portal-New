# Deprecation and Cleanup Guide

**Last Updated**: September 14, 2025

This guide provides instructions for removing deprecated files and cleaning up the codebase following the recent audit. The new single source of truth for documentation is `DEVELOPER_GUIDE.md`.

## 1. Deprecated Documentation Files

The following documentation files are now outdated and should be deleted. Their contents have been superseded by `DEVELOPER_GUIDE.md`.

**Files to Delete**:

-   `MASTER_GUIDE.md`
-   `AUTHENTICATION_ARCHITECTURE.md`
-   `AUTHENTICATION_IMPLEMENTATION.md`
-   `docs/SECURITY.md`
-   `docs/ROLE_MANAGEMENT.md`
-   `docs/RATE_LIMITING.md`
-   `docs/MIDDLEWARE_MIGRATION.md`
-   `TODO.md` (Content is now part of the project's issue tracker or covered by the new guide)
-   `THINGS_TO_DO_BEFORE_PRODUCTION.md` (Should be moved to a project management tool or issue tracker)

**Action**: Run the following commands to remove these files:

```bash
rm MASTER_GUIDE.md AUTHENTICATION_ARCHITECTURE.md AUTHENTICATION_IMPLEMENTATION.md TODO.md THINGS_TO_DO_BEFORE_PRODUCTION.md
rm docs/SECURITY.md docs/ROLE_MANAGEMENT.md docs/RATE_LIMITING.md docs/MIDDLEWARE_MIGRATION.md
```

## 2. Deprecated Code Files

The following code files are no longer in use or have been replaced by centralized modules.

**Files to Delete**:

-   `src/lib/supabase/middleware.ts`: This file is explicitly deprecated and throws an error on use. It is safe to delete.

**Action**: Run the following command:

```bash
rm src/lib/supabase/middleware.ts
```

## 3. Audit Report Consolidation

The new audit report has been created as `AUDIT_REPORT_NEW.md`. The old report should be archived or deleted, and the new one should be renamed.

**Action**:

1.  Delete or archive the old `AUDIT_REPORT.md`.
2.  Rename `AUDIT_REPORT_NEW.md` to `AUDIT_REPORT.md`.

```bash
# Optional: Archive the old report
# mv AUDIT_REPORT.md AUDIT_REPORT_OLD.md

# Or, delete it
rm AUDIT_REPORT.md

mv AUDIT_REPORT_NEW.md AUDIT_REPORT.md
```

By following these steps, you will significantly clean up the codebase, reduce confusion for developers, and ensure that the project's documentation accurately reflects its current state.
