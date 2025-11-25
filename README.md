# DG Timeseries SQL

A Directus panel extension for displaying timeseries data from SQL queries. Visualize your time-based data with customizable line and bar charts powered by ApexCharts.

## Features

- **SQL Query Support**: Execute custom SQL queries to fetch timeseries data
- **Multiple Chart Types**: Line and bar charts with various styling options
- **Multiple Series**: Display multiple numeric series on the same chart
- **Customizable Appearance**: Configure colors, curves, fills, and axis display
- **Security**: Only SELECT queries are allowed, preventing destructive operations

## Requirements

- Directus 10.10.0 or higher

## Installation

1. Install the extension:
```bash
npm install
```

2. Build the extension:
```bash
npm run build
```

3. Link the extension to your Directus instance:
```bash
npm run link
```

Or copy the `dist` folder to your Directus `extensions` directory.

## Usage

### Adding the Panel to a Dashboard

1. Navigate to your Directus dashboard
2. Create a new dashboard or edit an existing one
3. Click "Add Panel" and select "DG Timeseries SQL"
4. Configure the panel options (see Configuration below)

### SQL Query Format

Your SQL query must return data in the following format:

- **First column**: Datetime/timestamp column (will be used as the X-axis)
- **Subsequent columns**: Numeric columns (will be displayed as series on the Y-axis)

The datetime column can be:
- A `DATE`, `DATETIME`, or `TIMESTAMP` column
- A string in ISO format (e.g., `'2024-01-01'` or `'2024-01-01 12:00:00'`)
- A Unix timestamp (number)

**Example Query:**
```sql
SELECT 
    created_at,
    temperature,
    humidity
FROM sensor_readings
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY created_at ASC
```

This query will create a chart with:
- X-axis: `created_at` (datetime)
- Two series: `temperature` and `humidity` (numeric values)

### Configuration Options

#### SQL Query
- **Field**: `sqlQuery`
- **Type**: Multiline text input
- **Description**: The SQL SELECT query to execute. Must return at least 2 columns (datetime + at least one numeric column).

#### Chart Type
- **Field**: `chartType`
- **Type**: Dropdown
- **Options**: `line`, `bar`
- **Default**: `line`

#### Color
- **Field**: `color`
- **Type**: Color picker
- **Description**: Base color for the chart. When multiple series are present, colors will be automatically generated.

#### Decimals
- **Field**: `decimals`
- **Type**: Integer
- **Description**: Number of decimal places to display for numeric values
- **Default**: `0`

#### Min/Max Value
- **Fields**: `min`, `max`
- **Type**: Integer
- **Description**: Set custom Y-axis range. Leave empty for automatic scaling.

#### Curve Type
- **Field**: `curveType`
- **Type**: Dropdown
- **Options**: `smooth`, `straight`, `stepline`
- **Default**: `smooth`
- **Note**: Only applies to line charts

#### Fill Type
- **Field**: `fillType`
- **Type**: Dropdown
- **Options**: `gradient`, `solid`, `disabled`
- **Default**: `gradient`
- **Note**: Only applies to line charts

#### Missing Data
- **Field**: `missingData`
- **Type**: Dropdown
- **Options**: 
  - `ignore` (continuous line)
  - `null` (gap in line)
  - `0` (treat as zero)
  - Custom value
- **Default**: `null`

#### Show X/Y Axis
- **Fields**: `showXAxis`, `showYAxis`
- **Type**: Boolean
- **Description**: Toggle visibility of chart axes
- **Default**: `true` for both

## Examples

### Single Series Line Chart
```sql
SELECT 
    date,
    sales_amount
FROM daily_sales
WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
ORDER BY date ASC
```

### Multiple Series Comparison
```sql
SELECT 
    timestamp,
    revenue,
    expenses,
    profit
FROM financial_data
WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
ORDER BY timestamp ASC
```

### Aggregated Data
```sql
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_orders,
    SUM(total_amount) as total_revenue
FROM orders
WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
GROUP BY DATE(created_at)
ORDER BY date ASC
```

## Security

The extension includes built-in security measures:

- Only `SELECT` queries are allowed
- Destructive operations (`DROP`, `DELETE`, `TRUNCATE`, `ALTER`, `CREATE`, `INSERT`, `UPDATE`) are blocked
- Queries are validated before execution

**Important**: Ensure your Directus instance has proper database permissions configured. Users should only have access to execute queries on tables they're authorized to view.

## Development

### Build
```bash
npm run build
```

### Development Mode
```bash
npm run dev
```

### Validate
```bash
npm run validate
```

## Troubleshooting

### Chart Not Displaying

1. **Check SQL Query**: Ensure your query returns at least 2 columns and follows the required format
2. **Check Data Types**: Verify the first column contains valid datetime values
3. **Check Browser Console**: Open developer tools to see error messages
4. **Verify Endpoint**: Ensure the `/dg-timeseries-sql` endpoint is accessible

### Query Errors

- **"Only SELECT queries are allowed"**: Your query must start with `SELECT`
- **"SQL query must return at least 2 columns"**: Add more columns to your query
- **Database errors**: Check your database connection and table permissions

### Performance

For large datasets, consider:
- Adding `LIMIT` clauses to your queries
- Using date filters to reduce data volume
- Aggregating data at the database level before visualization

## License

See package.json for license information.

