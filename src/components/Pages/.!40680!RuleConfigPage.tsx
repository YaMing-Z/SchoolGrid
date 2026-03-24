import { useState } from 'react'
import { useRuleStore, DEFAULT_SCHEDULE_CONFIG } from '@/stores/ruleStore'
import { useScheduleStore } from '@/stores/scheduleStore'
import { Subject, getSubjectName } from '@/data/constants'
import { useScheduleConfig } from '@/hooks/useScheduleConfig'
import { GenerateScheduleConfirmModal } from '@/components/Dashboard/GenerateScheduleConfirmModal'

export function RuleConfigPage() {
  const [activeTab, setActiveTab] = useState<'subject' | 'global' | 'teacher' | 'schedule'>('schedule')
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  return (
    <div className="p-6 max-w-[1200px] mx-auto animate-fade-in flex flex-col h-full">
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-serif text-3xl font-semibold text-[var(--color-text-primary)]">
