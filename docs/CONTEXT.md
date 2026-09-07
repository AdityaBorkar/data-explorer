# Data Explorer

A shared explorer for browsing, refining, and acting on structured records.

## Language

### Refining

**Column**:
A named field of a record with a known data type.
_Avoid_: Field, attribute, property

**Filter Condition**:
A single predicate on one column, combined with others by and/or.
_Avoid_: Refine, query, facet

**Filter Group**:
A nested and/or grouping of filter conditions.
_Avoid_: Filter set, bracket

**Search**:
Global text hunt across the columns marked searchable.
_Avoid_: Global filter, fuzzy search

**Domain**:
Scope key isolating one record set's data and saved views.
_Avoid_: Tenant, workspace, namespace

### Showing

**Display**:
The visible shape of the explorer: which columns show and how wide, how rows order and group, row spacing, and presentation type.
_Avoid_: Layout, view config

**View**:
A saved named pairing of a display with a set of filter conditions.
_Avoid_: Preset, layout, saved filter

**View Type**:
The presentation of records.
_Avoid_: Layout, mode

**Density**:
Row spacing preference.
_Avoid_: Spacing, compactness

### Acting

**Selection**:
The set of chosen rows for batch action.
_Avoid_: Checked rows, marked rows

**Board Move**:
Relocating a record from one group to another.
_Avoid_: Drag, drop
