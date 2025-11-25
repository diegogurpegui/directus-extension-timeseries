import { defineEndpoint } from '@directus/extensions-sdk';

export default defineEndpoint((router, context) => {
	router.post('/', async (req, res) => {
		const { query } = req.body;

		if (!query || typeof query !== 'string') {
			return res.status(400).json({ error: 'SQL query is required' });
		}

		// Basic validation: prevent destructive operations
		const dangerousKeywords = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 'INSERT', 'UPDATE'];
		const upperQuery = query.toUpperCase().trim();
		
		for (const keyword of dangerousKeywords) {
			if (upperQuery.startsWith(keyword)) {
				return res.status(400).json({ 
					error: `Query cannot start with ${keyword}. Only SELECT queries are allowed.` 
				});
			}
		}

		// Ensure it's a SELECT query
		if (!upperQuery.startsWith('SELECT')) {
			return res.status(400).json({ 
				error: 'Only SELECT queries are allowed' 
			});
		}

		try {
			// Access database service from context
			const database = (context as any).services?.database || (context as any).database;
			
			if (!database) {
				return res.status(500).json({ 
					error: 'Database service not available' 
				});
			}

			const result = await database.raw(query);
			
			// Handle different database response formats
			// MySQL/MariaDB returns [rows, fields], PostgreSQL returns rows directly
			const rows = Array.isArray(result) && result.length > 0 && Array.isArray(result[0]) 
				? result[0] 
				: result;

			res.json({ data: rows });
		} catch (error: any) {
			res.status(500).json({ 
				error: 'Error executing query',
				message: error.message 
			});
		}
	});
});

