import type { Meta, StoryObj } from '@storybook/react'
import StatusBadge from './StatusBadge'

const meta = {
  title: 'UI/StatusBadge',
  component: StatusBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof StatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Autorizada: Story = {
  args: { status: 'AUTORIZADA' },
}

export const Processando: Story = {
  args: { status: 'PROCESSANDO' },
}

export const Rejeitada: Story = {
  args: { status: 'REJEITADA' },
}

export const Cancelada: Story = {
  args: { status: 'CANCELADA' },
}

export const ErroTemporario: Story = {
  args: { status: 'ERRO_TEMPORARIO' },
}

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <StatusBadge status="AUTORIZADA" />
      <StatusBadge status="PROCESSANDO" />
      <StatusBadge status="REJEITADA" />
      <StatusBadge status="CANCELADA" />
      <StatusBadge status="ERRO_TEMPORARIO" />
    </div>
  ),
}
