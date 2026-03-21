

interface Step {
  title: string
  description: string
  icon: string
}

const steps: Step[] = [
  { title: '导入基础数据', description: '上传教师、班级和教学任务', icon: '📥' },
  { title: '配置排课规则', description: '设置连堂、教研活动等约束', icon: '⚙️' },
  { title: '自动生成课表', description: '智能引擎全校一键排课', icon: '⚡' },
  { title: '微调与导出', description: '手动调整冲突并导出 Excel', icon: '📋' },
]

interface StepperProps {
  currentStep: number
}

export function Stepper({ currentStep }: StepperProps) {
  return (
    <div className="w-full py-6 px-8 bg-white border-b border-[var(--color-border-light)] shadow-sm">
      <div className="max-w-[1200px] mx-auto">
        <div className="relative flex justify-between">
          {/* Progress bar background */}
          <div className="absolute top-1/2 left-0 w-full h-1 bg-[var(--color-border)] -translate-y-1/2 z-0 rounded-full" />
          
          {/* Active progress bar */}
          <div 
            className="absolute top-1/2 left-0 h-1 bg-[var(--color-primary)] -translate-y-1/2 z-0 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
          />

          {/* Steps */}
          {steps.map((step, index) => {
            const isActive = index === currentStep
            const isCompleted = index < currentStep

            return (
              <div key={index} className="relative z-10 flex flex-col items-center group">
                {/* Icon Circle */}
                <div 
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all duration-300
                    ${isActive ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/30 scale-110' : ''}
                    ${isCompleted ? 'bg-[var(--color-primary)] text-white' : ''}
                    ${!isActive && !isCompleted ? 'bg-white border-2 border-[var(--color-border)] text-[var(--color-text-muted)]' : ''}
                  `}
                >
                  {isCompleted && !isActive ? '✓' : step.icon}
                </div>

                {/* Text Context */}
                <div className={`mt-3 text-center transition-all duration-300 ${isActive ? 'scale-105' : ''}`}>
                  <div className={`text-sm font-semibold ${isActive || isCompleted ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                    {step.title}
                  </div>
                  <div className={`text-xs mt-1 ${isActive ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)] opacity-70'}`}>
                    {step.description}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
