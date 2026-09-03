import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import ExamplePage from "./routes/$id.tsx";
import HomePage from "./routes/index.tsx";
import "./styles.css";

const segments = window.location.pathname.split("/").filter(Boolean);

const app = (
	<StrictMode>
		{segments.length === 0 ? (
			<HomePage />
		) : segments.length === 1 && segments[0] !== undefined ? (
			<ExamplePage params={{ id: segments[0] }} />
		) : (
			<ExamplePage params={{ id: "__not_found__" }} />
		)}
	</StrictMode>
);

const elem = document.getElementById("root");
if (!elem) throw new Error("Root element not found");

// https://bun.com/docs/bundler/hot-reloading#import-meta-hot-data
if (import.meta.hot) {
	const root = import.meta.hot.data.root ?? createRoot(elem);
	import.meta.hot.data.root = root;
	root.render(app);
} else {
	createRoot(elem).render(app);
}
