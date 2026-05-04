'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

interface DataPoint {
  mes: string   // "Mai/26"
  emitidas: number
  limite: number
}

interface Props {
  data: DataPoint[]
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-text-1 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-text-2">
          {p.name === 'emitidas' ? 'Emitidas' : 'Limite'}: <span className="text-text-1 font-mono">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function UsageChart({ data }: Props) {
  const limite = data[data.length - 1]?.limite ?? 0

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E3050" vertical={false} />
        <XAxis
          dataKey="mes"
          tick={{ fill: '#8AA0B8', fontSize: 11 }}
          axisLine={{ stroke: '#1E3050' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#8AA0B8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1E3050' }} />
        {limite > 0 && (
          <ReferenceLine
            y={limite}
            stroke="#F0B414"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{ value: `Limite ${limite}`, fill: '#F0B414', fontSize: 10, position: 'right' }}
          />
        )}
        <Bar dataKey="emitidas" fill="#00E8FF" opacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  )
}
