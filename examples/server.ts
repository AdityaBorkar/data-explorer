import index from "./src/frontend.html";
import { GET as getSource } from "./src/routes/api.sources.$.ts";

const server = Bun.serve({
	development: process.env.NODE_ENV !== "production" && {
		console: true,
		hmr: true,
	},
	port: 4000,
	routes: {
		"/*": index,
		"/api/sources/*": getSource,
	},
});

console.log(`🚀 Server running at ${server.url}`);
