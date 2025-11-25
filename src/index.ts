import { definePanel } from "@directus/extensions";
import PanelTimeSeries from "./panel-time-series.vue";

export default definePanel({
  id: "dg-timeseries",
  name: "DG Timeseries SQL",
  description: "Display timeseries data from SQL query",
  icon: "show_chart",
  component: PanelTimeSeries,
  options: [
    {
      field: "sqlQuery",
      type: "string",
      name: "SQL Query",
      meta: {
        interface: "input-multiline",
        width: "full",
        options: {
          placeholder:
            "SELECT datetime_column, numeric_column1, numeric_column2 FROM table WHERE ...",
        },
      },
    },
    {
      field: "chartType",
      type: "string",
      name: "Chart Type",
      meta: {
        interface: "select-dropdown",
        width: "half",
        options: {
          choices: [
            {
              text: "Line",
              value: "line",
            },
            {
              text: "Bar",
              value: "bar",
            },
          ],
        },
      },
      schema: {
        default_value: "line",
      },
    },
    {
      field: "color",
      name: "$t:color",
      type: "string",
      meta: {
        interface: "select-color",
        width: "half",
      },
    },
    {
      field: "decimals",
      type: "integer",
      name: "$t:value_decimals",
      meta: {
        interface: "input",
        width: "half",
        options: {
          placeholder: "$t:decimals_placeholder",
        },
      },
      schema: {
        default_value: 0,
      },
    },
    {
      field: "min",
      type: "integer",
      name: "$t:min_value",
      meta: {
        interface: "input",
        width: "half",
        options: {
          placeholder: "$t:automatic",
        },
      },
    },
    {
      field: "max",
      type: "integer",
      name: "$t:max_value",
      meta: {
        interface: "input",
        width: "half",
        options: {
          placeholder: "$t:automatic",
        },
      },
    },
    {
      field: "curveType",
      type: "string",
      name: "$t:panels.time_series.curve_type",
      meta: {
        interface: "select-dropdown",
        width: "half",
        options: {
          choices: [
            {
              text: "Smooth",
              value: "smooth",
            },
            {
              text: "Straight",
              value: "straight",
            },
            {
              text: "Stepline",
              value: "stepline",
            },
          ],
        },
      },
      schema: {
        default_value: "smooth",
      },
    },
    {
      field: "fillType",
      type: "string",
      name: "$t:panels.time_series.fill_type",
      meta: {
        interface: "select-dropdown",
        width: "half",
        options: {
          choices: [
            {
              text: "Gradient",
              value: "gradient",
            },
            {
              text: "Solid",
              value: "solid",
            },
            {
              text: "Disabled",
              value: "disabled",
            },
          ],
        },
      },
      schema: {
        default_value: "gradient",
      },
    },
    {
      field: "missingData",
      type: "string",
      name: "$t:panels.time_series.missing_data",
      meta: {
        interface: "select-dropdown",
        width: "half",
        options: {
          choices: [
            {
              text: "$t:continuous",
              value: "ignore",
            },
            {
              text: "$t:gap",
              value: "null",
            },
            {
              text: "0",
              value: "0",
            },
          ],
          allowOther: true,
        },
      },
      schema: {
        default_value: null,
      },
    },
    {
      field: "showXAxis",
      type: "boolean",
      name: "$t:show_x_axis",
      meta: {
        interface: "boolean",
        width: "half",
      },
      schema: {
        default_value: true,
      },
    },
    {
      field: "showYAxis",
      type: "boolean",
      name: "$t:show_y_axis",
      meta: {
        interface: "boolean",
        width: "half",
      },
      schema: {
        default_value: true,
      },
    },
  ],
  minWidth: 12,
  minHeight: 6,
});
