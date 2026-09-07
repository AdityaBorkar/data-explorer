# Single npm export with one-way dependencies

Core + SQL helper ship in a single `.` export (no `./sql` subpath); UI blocks ship via `registry.json` on top of core. UI and SQL may depend on core, never the reverse, so consumers can adopt the headless logic without pulling UI baggage.
