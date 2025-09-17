---
id: task-3
title: Refactor API types file - separate concerns and reduce file size
status: To Do
assignee: []
created_date: '2025-09-17 02:37'
labels:
  - frontend
  - api
  - refactor
dependencies: []
priority: medium
---

## Description

Split the large streams.ts API file into separate modules for types, client logic, and endpoint definitions. Move type definitions to dedicated files and create cleaner separation of concerns.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Extract all interface/type definitions into separate types file
- [ ] #2 Create dedicated API client module
- [ ] #3 Split endpoint definitions by domain (streams, hits, analytics)
- [ ] #4 Add proper barrel exports for clean imports
<!-- AC:END -->
