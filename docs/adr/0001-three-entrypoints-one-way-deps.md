# Three entrypoints with one-way dependencies

Core ships the headless state, refining, and view logic; UI ships prebuilt components on top of core; SQL ships filter-to-WHERE on top of core. UI and SQL may depend on core, never the reverse, so consumers can adopt the headless logic without pulling UI or SQL baggage.
