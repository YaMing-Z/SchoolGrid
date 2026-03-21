import { useState } from 'react'
import { useScheduleStore } from '@/stores/scheduleStore'
import { SUBJECT_NAMES } from '@/data/constants'
import { AdjustmentPriority } from '@/types/adjustment.types'
import html2canvas from 'html2canvas'

const priorityConfig = {
  [AdjustmentPriority.P0]: {
    label: 'P0',
    name: '同日互换',
    color: '#10b981',
    icon: '🔄'
  },
  [AdjustmentPriority.P1]: {
    label: 'P1',
    name: '跨日互换',
    color: '#3b82f6',
    icon: '📆'
  },
  [AdjustmentPriority.P2]: {
    label: 'P2',
    name: '代课',
    color: '#f59e0b',
    icon: '👥'
  }
}

const DAYS = ['周一', '周二', '周三', '周四', '周五']

export function AdjustmentProposalPanel() {
  const { currentProposal, clearProposal, teachers, classes } = useScheduleStore()
  const [isExporting, setIsExporting] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!currentProposal) return null

  const config = priorityConfig[currentProposal.priority]

  const getTeacherName = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId || t.employeeId === teacherId)
    return teacher?.name || teacherId
  }

  const getClassName = (classId: string) => {
    const cls = classes.find(c => c.id === classId)
    return cls?.name || classId
  }

  const formatSlot = (dayOfWeek: number, period: number) => {
    return `${DAYS[dayOfWeek - 1]}第${period}节`
  }

  // 导出为图片
  const handleExportImage = async () => {
    const panel = document.getElementById('proposal-panel')
    if (!panel) return

    setIsExporting(true)
    try {
      const canvas = await html2canvas(panel, {
        backgroundColor: '#ffffff',
        scale: 2
      })
      const link = document.createElement('a')
      link.download = `调课方案_${new Date().toLocaleDateString()}.png`
      link.href = canvas.toDataURL()
      link.click()
    } catch (error) {
      console.error('导出图片失败:', error)
    } finally {
      setIsExporting(false)
    }
  }

  // 复制方案文字
  const handleCopyText = async () => {
    const text = `
【调课方案】
班级：${getClassName(currentProposal.originalCell.classId)}
原课程：${formatSlot(currentProposal.originalCell.dayOfWeek as number, currentProposal.originalCell.period)} ${SUBJECT_NAMES[currentProposal.originalCell.subject]} - ${getTeacherName(currentProposal.originalCell.teacherId)}
调整为：${formatSlot(currentProposal.targetSlot.dayOfWeek, currentProposal.targetSlot.period)}
优先级：${config.name}
评分：${currentProposal.score}分
${currentProposal.violations.length > 0 ? `\n注意事项：\n${currentProposal.violations.map(v => `• ${v}`).join('\n')}` : ''}
    `.trim()

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('复制失败:', error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div
        id="proposal-panel"
        className="w-[480px] bg-white rounded-2xl shadow-2xl border border-[var(--color-border-light)] overflow-hidden"
      >
        {/* Header */}
        <div 
          className="p-5 text-white"
          style={{ background: `linear-gradient(135deg, ${config.color}, ${config.color}dd)` }}
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-xl font-semibold flex items-center gap-2">
                <span>{config.icon}</span>
                调课方案
              </h3>
              <p className="text-sm text-white/80 mt-1">
                {getClassName(currentProposal.originalCell.classId)}
              </p>
            </div>
            <button
              onClick={clearProposal}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 调课对比 */}
        <div className="p-5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-4">
            {/* 原课程 */}
            <div className="flex-1 p-4 rounded-xl bg-red-50 border border-red-200">
              <div className="text-xs text-red-600 font-medium mb-2">原课程位置</div>
              <div className="text-lg font-semibold text-red-700">
                {formatSlot(currentProposal.originalCell.dayOfWeek as number, currentProposal.originalCell.period)}
              </div>
              <div className="text-sm text-red-600 mt-1">
                {SUBJECT_NAMES[currentProposal.originalCell.subject]}
              </div>
              <div className="text-xs text-red-500 mt-1">
                {getTeacherName(currentProposal.originalCell.teacherId)}
              </div>
            </div>

            {/* 箭头 */}
            <div className="text-2xl text-gray-400">→</div>

            {/* 目标位置 */}
            <div className="flex-1 p-4 rounded-xl bg-green-50 border border-green-200">
              <div className="text-xs text-green-600 font-medium mb-2">目标位置</div>
              <div className="text-lg font-semibold text-green-700">
                {formatSlot(currentProposal.targetSlot.dayOfWeek, currentProposal.targetSlot.period)}
              </div>
              <div className="text-sm text-green-600 mt-1">
                {SUBJECT_NAMES[currentProposal.originalCell.subject]}
              </div>
              <div className="text-xs text-green-500 mt-1">
                {getTeacherName(currentProposal.originalCell.teacherId)}
              </div>
            </div>
          </div>
        </div>

        {/* 方案评估 */}
        <div className="p-5 border-b border-[var(--color-border)] bg-gray-50">
          <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
            <span>📊</span> 方案评估
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">优先级：</span>
              <span 
                className="px-2 py-0.5 rounded text-white text-sm font-medium"
                style={{ backgroundColor: config.color }}
              >
                {config.label} {config.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">综合评分：</span>
              <span className="font-bold text-lg" style={{ color: config.color }}>
                {currentProposal.score}分
              </span>
            </div>
          </div>
          
          {currentProposal.violations.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="text-sm font-medium text-yellow-700 mb-1">⚠️ 注意事项</div>
              <ul className="text-xs text-yellow-600 space-y-1">
                {currentProposal.violations.map((v, i) => (
                  <li key={i}>• {v.message}{v.suggestion && ` - ${v.suggestion}`}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 影响信息 */}
        {currentProposal.impact && (
          <div className="p-5 border-b border-[var(--color-border)] bg-blue-50">
            <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
              <span>👥</span> 影响信息
            </h4>
            <div className="space-y-3">
              {/* 受影响的教师 */}
              {currentProposal.impact.affectedTeachers && currentProposal.impact.affectedTeachers.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">需要通知的教师：</div>
                  <div className="flex flex-wrap gap-2">
                    {currentProposal.impact.affectedTeachers.map((teacherId) => (
                      <span
                        key={teacherId}
                        className="px-2 py-1 bg-white rounded-lg text-sm text-gray-700 border border-blue-200 flex items-center gap-1"
                      >
                        <span>👨‍🏫</span>
                        {getTeacherName(teacherId)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 受影响的班级 */}
              {currentProposal.impact.affectedClasses && currentProposal.impact.affectedClasses.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">受影响的班级：</div>
                  <div className="flex flex-wrap gap-2">
                    {currentProposal.impact.affectedClasses.map((classId) => (
                      <span
                        key={classId}
                        className="px-2 py-1 bg-white rounded-lg text-sm text-gray-700 border border-blue-200"
                      >
                        {getClassName(classId)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 干扰程度 */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">干扰程度：</span>
                <span className={`px-2 py-0.5 rounded text-white text-xs font-medium ${
                  currentProposal.impact.disruptionLevel === 'low' ? 'bg-green-500' :
                  currentProposal.impact.disruptionLevel === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                }`}>
                  {currentProposal.impact.disruptionLevel === 'low' ? '低' :
                   currentProposal.impact.disruptionLevel === 'medium' ? '中' : '高'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="p-5 flex gap-3">
          <button
            onClick={handleExportImage}
            disabled={isExporting}
            className="flex-1 py-3 px-4 rounded-xl border border-[var(--color-border)]
                       text-[var(--color-text-secondary)] font-medium
                       hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <span>📷</span>
            <span>{isExporting ? '导出中...' : '导出图片'}</span>
          </button>
          <button
            onClick={handleCopyText}
            className="flex-1 py-3 px-4 rounded-xl border border-[var(--color-border)]
                       text-[var(--color-text-secondary)] font-medium
                       hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <span>📋</span>
            <span>{copied ? '已复制!' : '复制方案'}</span>
          </button>
          <button
            onClick={clearProposal}
            className="flex-1 py-3 px-4 rounded-xl bg-gray-100
                       text-gray-600 font-medium
                       hover:bg-gray-200 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
