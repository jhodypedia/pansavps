"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function RevenueChart({
  data,
}: {
  data: { label: string; revenue: number; orders: number }[];
}) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 260 }}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#EDF1EE" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#8A9A90" }}
            axisLine={{ stroke: "#E3E8E4" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#8A9A90" }}
            axisLine={false}
            tickLine={false}
            width={64}
            tickFormatter={(value: number) =>
              value >= 1_000_000
                ? `${(value / 1_000_000).toFixed(0)} jt`
                : value >= 1000
                  ? `${Math.round(value / 1000)} rb`
                  : String(value)
            }
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #E3E8E4",
              fontSize: 12,
              boxShadow: "0 8px 24px -12px rgba(11,61,46,0.25)",
            }}
            formatter={(value, name) => {
              if (name === "revenue") {
                return [
                  new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    maximumFractionDigits: 0,
                  }).format(Number(value)),
                  "Pendapatan",
                ];
              }
              return [String(value), "Invoice"];
            }}
            labelStyle={{ color: "#101613", fontWeight: 600 }}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#0B3D2E"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#0B3D2E", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
