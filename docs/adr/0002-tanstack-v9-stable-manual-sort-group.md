# TanStack v9 stable with server-driven sort and grouping

Table state rides on TanStack Table v9 stable (`^9.2.4`, `useTable` + `tableFeatures`) with `manualSorting`/`manualGrouping`, so the server returns pre-sorted flat rows and table state only drives header UI. We stayed on the v9 feature API over backporting to stable v8.
