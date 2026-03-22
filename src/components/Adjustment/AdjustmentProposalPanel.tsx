import { useState } from 'react'
import { useScheduleStore } from '@/stores/scheduleStore'
import { SUBJECT_NAMES } from '@/data/constants'
import { AdjustmentPriority } from '@/types/adjustment.types'

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

  // 获取目标位置的课程信息
  const getTargetCellInfo = () => {
    if (!currentProposal.targetCell) return null
    return currentProposal.targetCell
  }

  const targetCell = getTargetCellInfo()

  // 复制方案文字
  const handleCopyText = async () => {
    const originalCell = currentProposal.originalCell
    const targetSlot = currentProposal.targetSlot

    let text = `
═══════════════════════════════════════
           📅 调课方案详情
═══════════════════════════════════════

📋 基本信息
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
班级：${getClassName(originalCell.classId)}
优先级：${config.label} - ${config.name}
综合评分：${currentProposal.score}分
方案类型：${targetCell ? '课程互换' : '调整到空位'}

🔴 原课程信息
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
时间：${formatSlot(originalCell.dayOfWeek as number, originalCell.period)}
课程：${SUBJECT_NAMES[originalCell.subject]}
教师：${getTeacherName(originalCell.teacherId)}
班级：${getClassName(originalCell.classId)}

${targetCell ? `🟢 目标位置现有课程
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
时间：${formatSlot(targetSlot.dayOfWeek, targetSlot.period)}
课程：${SUBJECT_NAMES[targetCell.subject]}
教师：${getTeacherName(targetCell.teacherId)}
班级：${getClassName(targetCell.classId)}

📊 调整后安排
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formatSlot(originalCell.dayOfWeek as number, originalCell.period)}${SUBJECT_NAMES[originalCell.subject]} → ${formatSlot(targetSlot.dayOfWeek, targetSlot.period)}
${formatSlot(targetSlot.dayOfWeek, targetSlot.period)}${SUBJECT_NAMES[targetCell.subject]} → ${formatSlot(originalCell.dayOfWeek as number, originalCell.period)}` : `🟢 目标位置
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
时间：${formatSlot(targetSlot.dayOfWeek, targetSlot.period)}
状态：空闲时段（原课程将移动至此）

📊 调整后安排
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formatSlot(originalCell.dayOfWeek as number, originalCell.period)}${SUBJECT_NAMES[originalCell.subject]} → ${formatSlot(targetSlot.dayOfWeek, targetSlot.period)}`}

${currentProposal.impact ? `
👥 影响范围
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${currentProposal.impact.affectedTeachers?.length ? `受影响教师：${currentProposal.impact.affectedTeachers.map(getTeacherName).join('、')}` : ''}
${currentProposal.impact.affectedClasses?.length ? `受影响班级：${currentProposal.impact.affectedClasses.map(getClassName).join('、')}` : ''}
干扰程度：${currentProposal.impact.disruptionLevel === 'low' ? '🟢 低' : currentProposal.impact.disruptionLevel === 'medium' ? '🟡 中' : '🔴 高'}
` : ''}

${currentProposal.violations.length > 0 ? `
⚠️  注意事项
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${currentProposal.violations.map(v => `• ${v.message}${v.suggestion ? `\n  建议：${v.suggestion}` : ''}`).join('\n')}
` : ''}

═══════════════════════════════════════
生成时间：${new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
═══════════════════════════════════════
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
              <div className="text-xs text-red-400 mt-1">
                {getClassName(currentProposal.originalCell.classId)}
              </div>
            </div>

            {/* 双向箭头 */}
            <div className="flex items-center justify-center text-gray-400">
              <svg width="32" height="24" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="12" x2="28" y2="12"></line>
                <polyline points="12 5 4 12 12 19"></polyline>
                <polyline points="20 5 28 12 20 19"></polyline>
              </svg>
            </div>

            {/* 目标位置 - 显示原有课程信息 */}
            <div className={`flex-1 p-4 rounded-xl border ${targetCell ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
              <div className={`text-xs font-medium mb-2 ${targetCell ? 'text-orange-600' : 'text-green-600'}`}>
                {targetCell ? '目标位置（现有课程）' : '目标位置（空闲时段）'}
              </div>
              <div className={`text-lg font-semibold ${targetCell ? 'text-orange-700' : 'text-green-700'}`}>
                {formatSlot(currentProposal.targetSlot.dayOfWeek, currentProposal.targetSlot.period)}
              </div>
              {targetCell ? (
                <>
                  <div className="text-sm text-orange-600 mt-1">
                    {SUBJECT_NAMES[targetCell.subject]}
                  </div>
                  <div className="text-xs text-orange-500 mt-1">
                    {getTeacherName(targetCell.teacherId)}
                  </div>
                  <div className="text-xs text-orange-400 mt-1">
                    {getClassName(targetCell.classId)}
                  </div>
                </>
              ) : (
                <div className="text-sm text-green-500 mt-1">
                  原课程将移动至此
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 影响信息 - 移到方案评估上方 */}
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

        {/* 操作按钮 - 移除导出图片功能 */}
        <div className="p-5 flex gap-3">
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
