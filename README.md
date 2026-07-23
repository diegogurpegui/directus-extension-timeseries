# DG Timeseries SQL

Display timeseries from SQL queries on Directus dashboards with customizable line and bar charts (powered by [ApexCharts](https://apexcharts.com/)).

## Features

- **SQL Query Support**: Execute custom SQL queries to fetch timeseries data
- **Multiple Chart Types**: Line and bar charts with various styling options
- **Multiple Series**: Display multiple numeric series on the same chart
- **Customizable Appearance**: Configure colors, curves, fills, axis display, and time grouping (days, weeks, months, years)
- **Security**: Only SELECT queries are allowed, preventing destructive operations

## Requirements

- Directus 10.10.0 or higher

## Installation

### Directus Marketplace (recommended)

1. In the Data Studio, open **Settings → Marketplace** (or add the panel from a dashboard’s extension picker, depending on your Directus version).
2. Search for **dg-timeseries** or **timeseries**.
3. Install the extension and restart Directus if prompted.

This bundle includes a panel and a SQL endpoint. The endpoint runs with full database access (not the Marketplace sandbox), so self-hosted instances with default Marketplace settings may need `MARKETPLACE_TRUST=all`. See [Including Extensions](https://directus.com/docs/self-hosting/including-extensions). Cloud and hosted projects follow their platform’s Marketplace trust policy.

### npm

From your Directus project’s `extensions` directory:

```bash
npm install dg-timeseries
```

Restart Directus after installation.

### From source

1. Clone [directus-extension-timeseries](https://github.com/diegogurpegui/directus-extension-timeseries) and install dependencies:

```bash
npm install
```

2. Build the extension:

```bash
npm run build
```

3. Link to your Directus instance or copy the `dist` folder into your project’s `extensions` directory:

```bash
npm run link
```

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
- Month buckets as `'YYYY-MM'` (e.g., `'2024-04'`) or year buckets as `'YYYY'` when using the matching **Time grouping** option
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

#### Time Grouping
- **Field**: `timeGrouping`
- **Type**: Dropdown
- **Options**: `days`, `weeks`, `months`, `years`
- **Default**: `days`
- **Description**: Controls how the X-axis and tooltips format time. Set this to match how your SQL query groups data (e.g. `months` when the first column is `YYYY-MM` or monthly aggregates). Daily series should use `days`.

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

### Aggregated Data (by day)
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

Use **Time grouping**: `days`.

### Aggregated Data (by month)
```sql
SELECT 
    DATE_FORMAT(created_at, '%Y-%m') as month,
    COUNT(*) as total_orders,
    SUM(total_amount) as total_revenue
FROM orders
WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
GROUP BY DATE_FORMAT(created_at, '%Y-%m')
ORDER BY month ASC
```

Use **Time grouping**: `months`.

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
3. **Match Time Grouping**: If the chart X-axis shows day-level labels (e.g. mid-month dates) but your data is monthly or yearly, set **Time grouping** to `months` or `years` accordingly
4. **Check Browser Console**: Open developer tools to see error messages
5. **Verify Endpoint**: Ensure the `/dg-timeseries-sql` endpoint is accessible

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

