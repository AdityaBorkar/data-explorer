# Custom dataFilters instead of built-in column filters

Filtering lives in custom `table.state.dataFilters` (`FilterCondition[]` with its own CRUD) instead of TanStack's built-in column filters, because cross-column and/or combinators, global search, and SQL serialization need a single serializable shape the built-in per-column model cannot carry.
