---
id: task-4
title: Break down massive hits.py router - extract services and reduce complexity
status: To Do
assignee: []
created_date: '2025-09-17 02:37'
labels:
  - backend
  - refactor
  - tech-debt
dependencies: []
priority: high
---

## Description

Split the 723-line hits.py file into smaller, focused modules. Extract validation logic, query builders, and statistics calculations into separate service classes.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Extract validation logic into dedicated validator class
- [ ] #2 Create query builder service for complex SQL generation
- [ ] #3 Extract statistics calculation logic into separate module
- [ ] #4 Split endpoints into focused router files (basic hits, stats, batch)
- [ ] #5 Create shared utilities for common database operations
<!-- AC:END -->
