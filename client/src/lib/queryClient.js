import { QueryClient } from "@tanstack/react-query"

// Shared query client used across the React app.
// The defaults keep background refetch noise low and avoid mutation retries for
// user-triggered actions.
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
		mutations: {
			retry: 0,
		},
	},
})
