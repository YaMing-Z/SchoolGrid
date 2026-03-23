import { useState, useRef, useEffect } from 'react'
import { useScheduleStore } from '@/stores/scheduleStore'
import {
  exportGradeOverviewToExcel,
  exportAllClassSchedules,
  exportAllTeacherSchedules,
  downloadExcel
} from '@/services/excelService'

type ExportType = 'grade' | 'class' | 'teacher'

interface ExportOption {
  key: ExportType
  label: string
  icon: string
  description: string
}

const EXPORT_OPTIONS: ExportOption[] = [
  { key: 'grade', label: '导出级部总表', icon: '📊', description: '所有班级课程一览表' },
  { key: 'class', label: '导出班级课表', icon: '🏫', description: '所有班级课表汇总' },
  { key: 'teacher', label: '导出教师课表', icon: '👨‍🏫', description: '所有教师课表汇总' },
]

export function ExportDropdown() {
  const { schedule, classes, teachers } = useScheduleStore()
  const [isOpen, setIsOpen] = useState(false)
  const [exporting, setExporting] = useState<ExportType | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExport = async (type: ExportType) => {
    if (!schedule) {
      alert('请先生成课表')
      return
    }

    setExporting(type)
    setIsOpen(false)

    try {
      let buffer: ArrayBuffer
      let filename: string
      const timestamp = new Date().toISOString().slice(0, 10)

      switch (type) {
        case 'grade':
          buffer = exportGradeOverviewToExcel(schedule, classes)
          filename = `级部总课程表_${timestamp}.xlsx`
          break
        case 'class':
          buffer = exportAllClassSchedules(schedule, classes, teachers)
          filename = `班级课表汇总_${timestamp}.xlsx`
          break
        case 'teacher':
          buffer = exportAllTeacherSchedules(schedule, teachers, classes)
          filename = `教师课表汇总_${timestamp}.xlsx`
          break
      }

      downloadExcel(buffer, filename)
    } catch (error) {
      console.error('Export error:', error)
      alert('导出失败，请重试')
    } finally {
      setExporting(null)
    }
  }

  const isDisabled = !schedule

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isDisabled || exporting !== null}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
          ${isDisabled
            ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed'
            : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]'
          }
        `}
      >
        {exporting ? (
          <>
            <span className="animate-spin">⏳</span>
            <span>导出中...</span>
          </>
        ) : (
          <>
            <span>📥</span>
            <span>导出</span>
            <span className="text-xs opacity-70">▼</span>
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-[var(--color-border-light)] overflow-hidden z-50 animate-fade-in">
          {EXPORT_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => handleExport(option.key)}
              className="w-full px-4 py-3 text-left hover:bg-[var(--color-bg-secondary)] transition-colors duration-200 flex items-start gap-3 border-b border-[var(--color-border-light)] last:border-b-0"
            >
              <span className="text-lg">{option.icon}</span>
              <div>
                <div className="font-medium text-sm text-[var(--color-text-primary)]">
                  {option.label}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {option.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
