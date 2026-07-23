<script setup lang="ts">
import { abbreviateNumber } from '@directus/utils';
import { isNil, orderBy } from 'lodash';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useApi } from '@directus/extensions-sdk';
// Import ApexCharts - handle both ESM and CommonJS exports
import ApexChartsLib from 'apexcharts';

const ApexCharts = (ApexChartsLib as any).default || ApexChartsLib;

const props = withDefaults(
	defineProps<{
		height: number;
		showHeader?: boolean;
		id: string;
		now: Date;
		sqlQuery?: string;
		chartType?: 'line' | 'bar';
		color?: string | null;
		fillType?: string;
		curveType?: string;
		decimals?: number;
		min?: number;
		max?: number;
		showXAxis?: boolean;
		showYAxis?: boolean;
		missingData?: 'null' | 'ignore' | string;
		timeGrouping?: 'days' | 'weeks' | 'months' | 'years';
	}>(),
	{
		showHeader: false,
		sqlQuery: '',
		timeGrouping: 'days',
		chartType: 'line',
		color: 'var(--theme--primary)',
		fillType: 'gradient',
		curveType: 'smooth',
		decimals: 0,
		min: undefined,
		max: undefined,
		showXAxis: true,
		showYAxis: true,
		missingData: 'null',
	},
);

const { d, n } = useI18n();
const api = useApi();

type DateMetric = { x: number; y: number | null };
type SeriesData = {
	name: string;
	data: DateMetric[];
};

const seriesData = ref<SeriesData[]>([]);
const chartEl = ref();
const chart = ref<any>();
const loading = ref(false);
const error = ref<string | null>(null);

const yAxisRange = computed(() => {
	let min = isNil(props.min) ? undefined : Number(props.min);
	let max = isNil(props.max) ? undefined : Number(props.max);

	if (max !== undefined && !min) {
		min = 0;
	}

	if (max !== undefined && min !== undefined && max < min) {
		max = min;
		min = Number(props.max);
	}

	return { max, min };
});

const dateRange = computed(() => {
	if (seriesData.value.length === 0) return { min: undefined, max: undefined };

	const allDates: number[] = [];
	seriesData.value.forEach(series => {
		series.data.forEach(point => {
			if (point.x) allDates.push(point.x);
		});
	});

	if (allDates.length === 0) return { min: undefined, max: undefined };

	return {
		min: Math.min(...allDates),
		max: Math.max(...allDates),
	};
});

const uniqueXCount = computed(() => {
	const timestamps = new Set<number>();
	seriesData.value.forEach((series) => {
		series.data.forEach((point) => {
			if (point.x) timestamps.add(point.x);
		});
	});
	return timestamps.size;
});

/**
 * Converts a SQL date column value to a Unix timestamp (ms).
 * Supports Date instances, numbers, and strings (year, year-month, or full dates).
 *
 * @param dateValue - Raw value from the first column of a query row.
 * @returns Milliseconds since epoch, or null if the value cannot be parsed.
 */
function parseDateColumnValue(dateValue: unknown): number | null {
	if (dateValue instanceof Date) {
		return dateValue.getTime();
	}

	if (typeof dateValue === 'number') {
		return dateValue;
	}

	if (typeof dateValue !== 'string') {
		return null;
	}

	const trimmed = dateValue.trim();
	if (!trimmed) return null;

	if (/^\d{4}$/.test(trimmed)) {
		return new Date(Number(trimmed), 0, 1).getTime();
	}

	if (/^\d{4}-\d{2}$/.test(trimmed)) {
		const [year, month] = trimmed.split('-').map(Number);
		return new Date(year, month - 1, 1).getTime();
	}

	const parsed = new Date(trimmed);
	return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

/**
 * Horizontal padding for the x-axis domain based on `timeGrouping`.
 *
 * @returns Padding in milliseconds added on each side of the data range.
 */
function xAxisPaddingMs(): number {
	const day = 24 * 60 * 60 * 1000;
	switch (props.timeGrouping) {
		case 'years':
			return 183 * day;
		case 'months':
			return 15 * day;
		case 'weeks':
			return 3.5 * day;
		default:
			return 0;
	}
}

/**
 * Formats a timestamp for tooltips and discrete x-axis labels.
 *
 * @param timestamp - Unix time in milliseconds.
 * @returns Localized date string according to `timeGrouping`.
 */
function formatTooltipDate(timestamp: number): string {
	const date = new Date(timestamp);
	switch (props.timeGrouping) {
		case 'years':
			return d(date, 'year');
		case 'months':
			return d(date, { year: 'numeric', month: 'long' });
		case 'weeks':
			return d(date, { year: 'numeric', month: 'short', day: 'numeric' });
		default:
			return d(date, 'long');
	}
}

/**
 * ApexCharts `datetimeFormatter` presets per zoom level for the current `timeGrouping`.
 *
 * @returns Formatter map for year, month, day, and hour tick labels.
 */
function xAxisDatetimeFormatter() {
	switch (props.timeGrouping) {
		case 'years':
			return {
				year: 'yyyy',
				month: 'yyyy',
				day: 'yyyy',
				hour: 'yyyy',
			};
		case 'months':
			return {
				year: "yyyy",
				month: "MMM 'yy",
				day: "MMM 'yy",
				hour: "MMM 'yy",
			};
		case 'weeks':
			return {
				year: "yyyy",
				month: "MMM 'yy",
				day: 'dd MMM',
				hour: 'dd MMM',
			};
		default:
			return {
				year: 'yyyy',
				month: "MMM 'yy",
				day: 'dd MMM',
				hour: 'HH:mm',
			};
	}
}

// Watch SQL query changes - fetch new data when query changes
watch(
	() => props.sqlQuery,
	async (newQuery, oldQuery) => {
		console.log('[Timeseries] SQL query changed:', {
			oldQuery: oldQuery?.substring(0, 50) + (oldQuery && oldQuery.length > 50 ? '...' : ''),
			newQuery: newQuery?.substring(0, 50) + (newQuery && newQuery.length > 50 ? '...' : ''),
			hasQuery: !!newQuery
		});
		if (props.sqlQuery) {
			await fetchData();
		} else {
			console.log('[Timeseries] No SQL query provided, clearing chart');
			chart.value?.destroy();
			seriesData.value = [];
		}
	},
	{ deep: true },
);

// Watch chart configuration changes - only update chart without re-fetching data
watch(
	[
		() => props.chartType,
		() => props.color,
		() => props.fillType,
		() => props.curveType,
		() => props.decimals,
		() => props.min,
		() => props.max,
		() => props.showXAxis,
		() => props.showYAxis,
		() => props.missingData,
		() => props.timeGrouping,
	],
	() => {
		console.log('[Timeseries] Chart configuration changed:', {
			chartType: props.chartType,
			timeGrouping: props.timeGrouping,
			color: props.color,
			fillType: props.fillType,
			curveType: props.curveType,
			decimals: props.decimals,
			min: props.min,
			max: props.max,
			showXAxis: props.showXAxis,
			showYAxis: props.showYAxis,
			missingData: props.missingData,
		});
		chart.value?.destroy();
		setupChart();
	},
	{ deep: true },
);

onMounted(async () => {
	console.log('[Timeseries] Component mounted', {
		hasSqlQuery: !!props.sqlQuery,
		sqlQueryLength: props.sqlQuery?.length || 0,
		chartType: props.chartType,
	});
	if (props.sqlQuery) {
		await fetchData();
	} else {
		console.log('[Timeseries] No SQL query on mount, skipping data fetch');
	}
});

// Watch for when chartEl becomes available and setup chart if we have data
watch(chartEl, async (newEl) => {
	console.log('[Timeseries] chartEl changed:', {
		hasElement: !!newEl,
		hasData: seriesData.value.length > 0,
		hasChart: !!chart.value,
		seriesCount: seriesData.value.length,
	});
	if (newEl && seriesData.value.length > 0 && !chart.value) {
		console.log('[Timeseries] Setting up chart - element available and data ready');
		await nextTick();
		setupChart();
	}
});

onUnmounted(() => {
	console.log('[Timeseries] Component unmounting, destroying chart');
	chart.value?.destroy();
});

/**
 * Loads chart data from the panel SQL query via `/dg-timeseries-sql` and updates `seriesData`.
 * On failure or empty results, clears series and refreshes the chart to show errors or empty state.
 */
async function fetchData() {
	console.log('[Timeseries] fetchData() called');
	if (!props.sqlQuery?.trim()) {
		console.log('[Timeseries] No SQL query provided, clearing data');
		seriesData.value = [];
		return;
	}

	console.log('[Timeseries] Starting data fetch', {
		queryLength: props.sqlQuery.length,
		queryPreview: props.sqlQuery.substring(0, 100) + (props.sqlQuery.length > 100 ? '...' : ''),
	});

	loading.value = true;
	error.value = null;

	try {
		console.log('[Timeseries] Sending API request to /dg-timeseries-sql');
		const response = await api.post('/dg-timeseries-sql', {
			query: props.sqlQuery,
		});
		console.log('[Timeseries] API response received', {
			status: response.status,
			hasData: !!response.data,
			responseKeys: Object.keys(response.data || {}),
		});

		// Handle response structure: endpoint returns { data: rows }
		// useApi() wraps axios, so response.data is the JSON body from the endpoint
		const responseData = response.data;
		console.log('[Timeseries] Processing response data', {
			hasError: !!responseData.error,
			error: responseData.error,
			message: responseData.message,
			hasData: !!responseData.data,
			dataIsArray: Array.isArray(responseData.data),
			dataLength: Array.isArray(responseData.data) ? responseData.data.length : 'N/A',
		});

		// Check if response has error
		if (responseData.error) {
			console.error('[Timeseries] Response contains error:', responseData.error);
			error.value = responseData.error || responseData.message || 'Error fetching data';
			seriesData.value = [];
			await nextTick();
			setupChart();
			return;
		}

		// Extract rows array from response
		// Endpoint returns { data: rows }, so responseData.data should be the array
		// Handle both wrapped { data: [...] } and direct array responses
		let rows: any[] = [];
		if (Array.isArray(responseData.data)) {
			rows = responseData.data;
			console.log('[Timeseries] Extracted rows from responseData.data');
		} else if (Array.isArray(responseData)) {
			rows = responseData;
			console.log('[Timeseries] Extracted rows from responseData directly');
		} else {
			console.warn('[Timeseries] Unexpected response format:', {
				responseDataType: typeof responseData,
				responseDataKeys: Object.keys(responseData || {}),
			});
		}

		console.log('[Timeseries] Rows extracted:', {
			rowCount: rows.length,
			firstRow: rows[0] ? Object.keys(rows[0]) : null,
		});

		if (rows.length === 0) {
			console.log('[Timeseries] No rows returned from query, clearing chart');
			seriesData.value = [];
			await nextTick();
			setupChart();
			return;
		}

		// Get column names from first row keys
		const firstRow = rows[0];
		const columnNames = Object.keys(firstRow);

		console.log('[Timeseries] Column analysis:', {
			columnCount: columnNames.length,
			columnNames: columnNames,
			firstRowSample: firstRow ? Object.fromEntries(
				Object.entries(firstRow).slice(0, 3).map(([k, v]) => [k, typeof v === 'object' ? String(v).substring(0, 50) : v])
			) : null,
		});

		if (columnNames.length < 2) {
			const errorMsg = 'SQL query must return at least 2 columns (datetime and at least one numeric column)';
			console.error('[Timeseries] Validation error:', errorMsg, { columnCount: columnNames.length });
			error.value = errorMsg;
			seriesData.value = [];
			await nextTick();
			setupChart();
			return;
		}

		// First column is datetime, rest are numeric series
		const dateColumn = columnNames[0]!;
		const numericColumns = columnNames.slice(1);
		console.log('[Timeseries] Column assignment:', {
			dateColumn,
			numericColumns,
			numericColumnCount: numericColumns.length,
		});

		// Parse data into series
		console.log('[Timeseries] Parsing data into series...');
		const parsedSeries: SeriesData[] = numericColumns.map((colName) => {
			const data: DateMetric[] = rows
				.map((row: any) => {
					const dateValue = row[dateColumn];
					const numericValue = row[colName];

					const timestamp = parseDateColumnValue(dateValue);
					if (timestamp === null) {
						return null;
					}

					// Parse numeric value
					let value: number | null = null;
					if (numericValue !== null && numericValue !== undefined) {
						const parsed = Number(numericValue);
						value = isNaN(parsed) ? null : Number(parsed.toFixed(props.decimals ?? 0));
					}

					return { x: timestamp, y: value };
				})
				.filter((point: DateMetric | null): point is DateMetric => point !== null);

			// Sort by date
			return {
				name: colName,
				data: orderBy(data, 'x'),
			};
		});

		console.log('[Timeseries] Data parsing complete:', {
			seriesCount: parsedSeries.length,
			seriesSummary: parsedSeries.map(s => ({
				name: s.name,
				pointCount: s.data.length,
				dateRange: s.data.length > 0 ? {
					min: new Date(Math.min(...s.data.map(d => d.x))).toISOString(),
					max: new Date(Math.max(...s.data.map(d => d.x))).toISOString(),
				} : null,
				valueRange: s.data.length > 0 ? {
					min: Math.min(...s.data.map(d => d.y ?? Infinity).filter(y => y !== Infinity)),
					max: Math.max(...s.data.map(d => d.y ?? -Infinity).filter(y => y !== -Infinity)),
				} : null,
				nullValueCount: s.data.filter(d => d.y === null).length,
			})),
		});

		seriesData.value = parsedSeries;
		await nextTick();
		setupChart();
	} catch (err: any) {
		console.error('[Timeseries] Error fetching data:', {
			message: err.message,
			response: err.response ? {
				status: err.response.status,
				statusText: err.response.statusText,
				data: err.response.data,
			} : null,
			stack: err.stack,
		});
		error.value = err.response?.data?.message || err.message || 'Error fetching data';
		seriesData.value = [];
		await nextTick();
		setupChart();
	} finally {
		loading.value = false;
		console.log('[Timeseries] fetchData() completed', {
			loading: loading.value,
			hasError: !!error.value,
			seriesCount: seriesData.value.length,
		});
	}
}

/**
 * Destroys any existing ApexCharts instance and renders a new chart from `seriesData` and panel props.
 * No-op when the chart container or data is missing.
 */
function setupChart() {
	console.log('[Timeseries] setupChart() called', {
		hasChartEl: !!chartEl.value,
		hasExistingChart: !!chart.value,
		seriesCount: seriesData.value.length,
	});

	if (!chartEl.value) {
		console.warn('[Timeseries] Cannot setup chart: chartEl not available');
		return;
	}

	if (!ApexCharts) {
		console.error('[Timeseries] Cannot setup chart: ApexCharts not available');
		error.value = 'Chart library not available';
		return;
	}

	chart.value?.destroy();

	if (seriesData.value.length === 0) {
		console.log('[Timeseries] Cannot setup chart: no series data');
		return;
	}

	// Determine chart type
	const isBar = props.chartType === 'bar';
	const isArea = !isBar && props.fillType !== 'disabled';
	const chartType = isBar ? 'bar' : isArea ? 'area' : 'line';

	console.log('[Timeseries] Chart configuration:', {
		chartType,
		isBar,
		isArea,
		seriesCount: seriesData.value.length,
		dateRange: dateRange.value,
		yAxisRange: yAxisRange.value,
	});

	// Generate colors for multiple series
	const baseColor = props.color || 'var(--theme--primary)';
	const colors = seriesData.value.length === 1
		? [baseColor]
		: generateColors(seriesData.value.length, baseColor);

	console.log('[Timeseries] Creating ApexCharts instance with', {
		colorCount: colors.length,
		colors: colors.slice(0, 3), // Log first 3 colors
	});

	const padding = xAxisPaddingMs();
	const xMin = dateRange.value.min !== undefined ? dateRange.value.min - padding : undefined;
	const xMax = dateRange.value.max !== undefined ? dateRange.value.max + padding : undefined;
	const discreteTimeAxis = props.timeGrouping !== 'days' && uniqueXCount.value > 0;

	chart.value = new ApexCharts(chartEl.value, {
		colors: colors,
		plotOptions: isBar
			? {
				bar: {
					columnWidth: discreteTimeAxis ? '55%' : '70%',
				},
			}
			: undefined,
		chart: {
			type: chartType,
			height: '100%',
			stacked: isBar,
			toolbar: {
				show: false,
			},
			selection: {
				enabled: false,
			},
			zoom: {
				enabled: false,
			},
			fontFamily: 'var(--theme--fonts--sans--font-family)',
			foreColor: 'var(--theme--foreground-subdued)',
			animations: {
				enabled: false,
			},
		},
		series: seriesData.value.map(series => ({
			name: series.name,
			data: series.data,
		})),
		stroke: {
			curve: isBar ? 'straight' : props.curveType,
			width: 2,
			lineCap: 'round',
		},
		markers: {
			hover: {
				size: undefined,
				sizeOffset: 4,
			},
		},
		fill: {
			type: isBar ? 'solid' : (props.fillType === 'disabled' ? 'solid' : props.fillType),
			gradient: isBar ? undefined : {
				colorStops: colors.map(color => [
					{
						offset: 0,
						color: color,
						opacity: 0.25,
					},
					{
						offset: 100,
						color: color,
						opacity: 0,
					},
				]),
			},
			opacity: isBar ? 0.8 : undefined,
		},
		grid: {
			borderColor: 'var(--theme--border-color-subdued)',
			padding: {
				top: props.showHeader ? -20 : -4,
				bottom: 0,
				left: 8,
			},
		},
		dataLabels: {
			enabled: false,
		},
		tooltip: {
			marker: {
				show: false,
			},
			x: {
				show: true,
				formatter(date: number) {
					return formatTooltipDate(date);
				},
			},
			y: {
				title: {
					formatter: (seriesName: string) => seriesName + ': ',
				},
				formatter(value: number) {
					return n(value);
				},
			},
		},
		xaxis: {
			type: 'datetime',
			tooltip: {
				enabled: false,
			},
			axisTicks: {
				show: false,
			},
			axisBorder: {
				show: false,
			},
			min: xMin,
			max: xMax,
			tickAmount: discreteTimeAxis ? uniqueXCount.value : undefined,
			labels: {
				show: props.showXAxis ?? true,
				offsetY: -4,
				style: {
					fontFamily: 'var(--theme--fonts--sans--font-family)',
					foreColor: 'var(--theme--foreground-subdued)',
					fontWeight: 600,
					fontSize: '10px',
				},
				datetimeUTC: false,
				datetimeFormatter: xAxisDatetimeFormatter(),
				formatter: discreteTimeAxis
					? (value: string) => formatTooltipDate(Number(value))
					: undefined,
			},
			crosshairs: {
				stroke: {
					color: 'var(--theme--form--field--input--border-color)',
				},
			},
		},
		yaxis: {
			show: props.showYAxis ?? true,
			forceNiceScale: true,
			min: yAxisRange.value.min,
			max: yAxisRange.value.max,
			tickAmount: props.height - 4,
			labels: {
				offsetY: 1,
				offsetX: -4,
				formatter: (value: number) => {
					return value > 10000
						? abbreviateNumber(value, 1)
						: n(value, 'decimal', {
							minimumFractionDigits: props.decimals ?? 0,
							maximumFractionDigits: props.decimals ?? 0,
						} as any);
				},
				style: {
					fontFamily: 'var(--theme--fonts--sans--font-family)',
					foreColor: 'var(--theme--foreground-subdued)',
					fontWeight: 600,
					fontSize: '10px',
				},
			},
		},
		legend: {
			show: seriesData.value.length > 1,
			position: 'top',
			horizontalAlign: 'right',
		},
	});

	console.log('[Timeseries] Rendering chart...');
	chart.value.render();
	console.log('[Timeseries] Chart rendered successfully');
}

/**
 * Builds a color palette for multiple series (theme variable or HSL steps).
 *
 * @param count - Number of series.
 * @param baseColor - Primary color from panel options.
 * @returns One color per series.
 */
function generateColors(count: number, baseColor: string): string[] {
	if (count === 1) return [baseColor];

	// Generate colors using HSL variation
	const colors: string[] = [];
	const hueStep = 360 / count;

	for (let i = 0; i < count; i++) {
		// Try to parse base color or use default
		if (baseColor.startsWith('var(--theme--')) {
			// Use theme colors for first few, then generate
			colors.push(baseColor);
		} else {
			// Generate HSL color
			const hue = (i * hueStep) % 360;
			colors.push(`hsl(${hue}, 70%, 50%)`);
		}
	}

	return colors;
}
</script>

<template>
	<div class="time-series">
		<div v-if="loading" class="loading">Loading...</div>
		<div v-else-if="error" class="error">{{ error }}</div>
		<div v-else-if="!sqlQuery" class="empty">Please configure a SQL query in the panel options</div>
		<div ref="chartEl" class="chart-container" />
	</div>
</template>

<style scoped>
.time-series {
	inline-size: 100%;
	block-size: 100%;
	position: relative;
}

.loading,
.error,
.empty {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 20px;
	color: var(--theme--foreground-subdued);
	font-size: 14px;
	background-color: var(--theme--background-normal);
	z-index: 1;
}

.error {
	color: var(--theme--danger);
}

.chart-container {
	inline-size: 100%;
	block-size: 100%;
	min-height: 200px;
}
</style>

<style>
.apexcharts-tooltip.apexcharts-theme-light {
	border-color: var(--theme--form--field--input--border-color) !important;
}

.apexcharts-tooltip.apexcharts-theme-light .apexcharts-tooltip-title {
	border-color: var(--theme--form--field--input--border-color) !important;
	margin-block-end: 0;
	padding: 0 4px;
	font-weight: 600 !important;
	font-size: 10px !important;
	background-color: var(--theme--background-subdued) !important;
}

.apexcharts-tooltip-y-group {
	padding: 0 0 0 4px;
	font-weight: 600 !important;
	font-size: 10px !important;
}

.apexcharts-tooltip-series-group {
	background-color: var(--theme--background-normal) !important;
	padding: 0;
}

.apexcharts-tooltip-series-group:last-child {
	padding-block-end: 0;
}
</style>
