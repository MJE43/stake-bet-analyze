---
id: task-1
title: >-
  Refactor LiveBetsTable component - extract cell components and reduce file
  size
status: To Do
assignee: []
created_date: '2025-09-17 02:37'
labels:
  - frontend
  - refactor
  - tech-debt
dependencies: []
priority: high
---

## Description

Break down the 477-line LiveBetsTable.tsx into smaller, focused components. Extract inline cell components (NonceCell, MultiplierCell, etc.) into separate files. Remove duplicate optimized version and consolidate logic.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Extract all inline cell components into separate files
- [ ] #2 Split table logic into smaller focused components
- [ ] #3 Remove duplicate LiveBetsTable.optimized.tsx file
- [ ] #4 Create shared styling utilities for table components
<!-- AC:END -->
