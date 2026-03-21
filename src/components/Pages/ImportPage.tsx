import { useState, useCallback } from 'react'
import { useScheduleStore } from '@/stores/scheduleStore'
import { importFromExcel, generateImportTemplate, downloadExcel } from '@/services/excelService'
import { validateConsistency } from '@/parsers/validators/consistencyValidator'

export function ImportPage() {
  const { setTeachers, setClasses, setCurriculumItems, setRawImportData, setValidationErrors, setValidationWarnings, generateSchedule } = useScheduleStore()
  const [isDragging, setIsDragging] = useState(false)
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [validationResult, setValidationResult] = useState<ReturnType<typeof validateConsistency> | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      processFile(file)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }, [])

  const processFile = async (file: File) => {
    setImportStatus('loading')

    try {
      const buffer = await file.arrayBuffer()
      console.log('[Import] File size:', buffer.byteLength, 'bytes')

      const result = importFromExcel(buffer)
      console.log('[Import] Parsed result:', {
        teachers: result.teachers.length,
        classes: result.classes.length,
        curriculumItems: result.curriculumItems.length,
        errors: result.errors,
        warnings: result.warnings
      })

      setTeachers(result.teachers)
      setClasses(result.classes)
      setCurriculumItems(result.curriculumItems)
      if (result.rawImportData) {
        setRawImportData(result.rawImportData)
      }

      // 验证数据一致性
      const validation = validateConsistency(
        result.teachers,
        result.classes,
        result.curriculumItems
      )
      console.log('[Import] Validation result:', validation)
      setValidationResult(validation)

      if (result.errors.length > 0) {
        setImportStatus('error')
        setValidationErrors(result.errors)
      } else {
        setImportStatus('success')
        setValidationErrors([])
        setValidationWarnings(result.warnings)
      }
    } catch (error) {
      console.error('Import error:', error)
      setImportStatus('error')
      setValidationErrors([`导入失败: ${error}`])
    }
  }

  const handleDownloadTemplate = () => {
    const buffer = generateImportTemplate()
    downloadExcel(buffer, 'SchoolGrid_导入模板.xlsx')
  }

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="font-serif text-3xl font-semibold text-[var(--color-text-primary)]">
          数据导入
        </h2>
        <p className="text-[var(--color-text-secondary)] mt-1">
          上传 Excel 文件导入教师、班级和教学计划数据
        </p>
      </div>

      {/* Template download */}
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-xl font-semibold mb-1">下载导入模板</h3>
            <p className="text-white/80 text-sm">
              使用标准模板可以确保数据格式正确，避免导入错误
            </p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="px-6 py-3 bg-white text-[var(--color-primary)] rounded-xl font-medium
                       hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <span>📥</span>
            <span>下载模板</span>
          </button>
        </div>
      </div>

      {/* Upload area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300
          flex flex-col items-center justify-center min-h-[240px]
          ${isDragging
            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 scale-[1.02]'
            : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
          }
        `}
      >
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />

        {importStatus === 'loading' ? (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-[var(--color-text-secondary)]">正在处理...</p>
          </div>
        ) : (
          <>
            <div className={`
              w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-4
              transition-all duration-300
              ${isDragging ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg-tertiary)]'}
            `}>
              {importStatus === 'success' ? '✅' : importStatus === 'error' ? '❌' : '📄'}
            </div>
            <p className="font-medium text-[var(--color-text-primary)] mb-1">
              {importStatus === 'success'
                ? '导入成功！'
                : importStatus === 'error'
                ? '导入失败，请检查文件格式'
                : isDragging
                ? '松开以上传文件'
                : '拖放文件到此处或点击上传'
              }
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              支持 .xlsx 和 .xls 格式
            </p>
          </>
        )}
      </div>

      {/* Validation results */}
      {validationResult && (
        <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-border-light)] overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <h3 className="font-serif font-semibold text-[var(--color-text-primary)]">
              数据验证结果
            </h3>
          </div>

          <div className="p-4 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                <div className="text-2xl font-serif font-bold text-[var(--color-text-primary)]">
                  {validationResult.summary.totalTeachers}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">教师</div>
              </div>
              <div className="text-center p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                <div className="text-2xl font-serif font-bold text-[var(--color-text-primary)]">
                  {validationResult.summary.totalClasses}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">班级</div>
              </div>
              <div className="text-center p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                <div className="text-2xl font-serif font-bold text-[var(--color-text-primary)]">
                  {validationResult.summary.totalCurriculumItems}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">课程条目</div>
              </div>
              <div className="text-center p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                <div className={`
                  text-2xl font-serif font-bold
                  ${validationResult.isValid ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}
                `}>
                  {validationResult.isValid ? '✓' : '✗'}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">验证状态</div>
              </div>
            </div>

            {/* Errors */}
            {validationResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-[var(--color-error)] flex items-center gap-2">
                  <span>⚠️</span>
                  <span>错误 ({validationResult.errors.length})</span>
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {validationResult.errors.map((error, i) => (
                    <div key={i} className="text-sm p-2 bg-red-50 text-[var(--color-error)] rounded-lg">
                      {error.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {validationResult.warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-[var(--color-warning)] flex items-center gap-2">
                  <span>💡</span>
                  <span>警告 ({validationResult.warnings.length})</span>
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {validationResult.warnings.map((warning, i) => (
                    <div key={i} className="text-sm p-2 bg-amber-50 text-[var(--color-warning)] rounded-lg">
                      {warning.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generate schedule button */}
            {validationResult.isValid && (
              <div className="pt-4 border-t border-[var(--color-border)]">
                <button
                  onClick={() => {
                    generateSchedule()
                    setValidationResult(null)
                  }}
                  className="w-full py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)]
                               text-white rounded-xl font-medium
                               hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                >
                  🚀 生成课表
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
