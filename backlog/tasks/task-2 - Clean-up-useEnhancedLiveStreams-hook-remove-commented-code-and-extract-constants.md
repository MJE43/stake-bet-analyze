---
id: task-2
title: >-
  Clean up useEnhancedLiveStreams hook - remove commented code and extract
  constants
status: To Do
assignee: []
created_date: '2025-09-17 02:37'
labels:
  - frontend
  - hooks
  - tech-debt
dependencies: []
priority: medium
---

## Description

Remove commented out code in useEnhancedLiveStreams.ts and extract magic numbers into named constants. Consolidate duplicate retry logic patterns across hooks.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Remove all commented out code blocks
- [ ] #2 Extract magic numbers (timeouts, retry counts) into constants
- [ ] #3 Consolidate duplicate retry/error handling logic
- [ ] #4 Add proper TypeScript types for hook parameters
<!-- AC:END -->
