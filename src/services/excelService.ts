import * as XLSX from 'xlsx'
import { Teacher } from '@/types/teacher.types'
import { SchoolClass } from '@/types/class.types'
import { CurriculumItem } from '@/types/curriculum.types'
import { ScheduleCell, SchoolSchedule, ClassSchedule } from '@/types/schedule.types'
import { SUBJECT_NAMES, Subject } from '@/data/constants'
import { parseMatrixExcel } from '@/parsers/matrixParser'
import { aggregateRulesWithData, AggregationInput } from '@/services/ruleAggregator'
import { useRuleStore } from '@/stores/ruleStore'

/**
 * Excel 导入导出服务
 */

export interface ImportResult {
  teachers: Teacher[]
  classes: SchoolClass[]
  curriculumItems: CurriculumItem[]
  rawImportData: AggregationInput | null
  errors: string[]
  warnings: string[]
}

/**
 * 从极简单表(Excel文件)导入基础任课名单数据，并与系统既定规则合并生成排课对象。
 */
export function importFromExcel(buffer: ArrayBuffer): ImportResult {
  console.log('[ExcelService] Starting matrix import, buffer size:', buffer.byteLength)
  try {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    if (!worksheet) {
      throw new Error('找不到可用的工作表')
    }

    // 1. 解析极简的横纵矩阵横向任课表
    const parsedData = parseMatrixExcel(worksheet)
    console.log('[ExcelService] Successfully extracted matrix data:', parsedData)
    
    // 2. 利用规则聚合引擎，补充上全部排课必须的属性（如：周课时数、优先度、禁排规则等）
    const aggregatedResult = aggregateRulesWithData(parsedData)
    console.log('[ExcelService] Applied rules aggregation:', {
      teachers: aggregatedResult.teachers.length,
      classes: aggregatedResult.classes.length,
      items: aggregatedResult.curriculumItems.length
    })

    return {
      teachers: aggregatedResult.teachers,
      classes: aggregatedResult.classes,
      curriculumItems: aggregatedResult.curriculumItems,
      rawImportData: parsedData,
      errors: [],
      warnings: []
    }
  } catch (error: any) {
    console.error('[ExcelService] Import error:', error)
    return {
      teachers: [],
      classes: [],
      curriculumItems: [],
      rawImportData: null,
      errors: [error.message || String(error)],
      warnings: []
    }
  }
}

/**
 * 导出课表到Excel
 */
export function exportScheduleToExcel(schedule: SchoolSchedule): ArrayBuffer {
  const workbook = XLSX.utils.book_new()

  // 为每个班级创建课表
  for (const classSchedule of schedule.classSchedules) {
    const sheetName = classSchedule.classId.substring(0, 31) // Excel sheet名称长度限制
    const worksheet = createClassScheduleSheet(classSchedule)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  }

  // 创建总览表
  const summarySheet = createSummarySheet(schedule)
  XLSX.utils.book_append_sheet(workbook, summarySheet, '总览')

  // 导出为ArrayBuffer
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return buffer
}

/**
 * 创建班级课表工作表
 */
function createClassScheduleSheet(classSchedule: ClassSchedule): XLSX.WorkSheet {
  // 创建表头
  const headers = ['节次', '周一', '周二', '周三', '周四', '周五']
  const rows: (string | number)[][] = [headers]

  // 获取动态节次配置
  const scheduleConfig = useRuleStore.getState().scheduleConfig
  const periods = scheduleConfig.periods.map(p => p.period)
  const maxPeriod = Math.max(...classSchedule.cells.map(c => c.period), ...periods)

  for (let period = 1; period <= maxPeriod; period++) {
    const row: (string | number)[] = [period]

    for (let day = 1; day <= 5; day++) {
      const cell = classSchedule.cells.find(
        c => c.dayOfWeek === day && c.period === period
      )

      if (cell) {
        const subjectName = SUBJECT_NAMES[cell.subject] || cell.subject
        row.push(subjectName)
      } else {
        row.push('')
      }
    }

    rows.push(row)
  }

  // 添加空行和备注
  rows.push([])
  rows.push(['生成时间', new Date().toLocaleString('zh-CN')])

  const worksheet = XLSX.utils.aoa_to_sheet(rows)

  // 设置列宽
  worksheet['!cols'] = [
    { wch: 8 },  // 节次
    { wch: 12 }, // 周一
    { wch: 12 }, // 周二
    { wch: 12 }, // 周三
    { wch: 12 }, // 周四
    { wch: 12 }  // 周五
  ]

  return worksheet
}

/**
 * 创建总览工作表
 */
function createSummarySheet(schedule: SchoolSchedule): XLSX.WorkSheet {
  const rows: (string | number)[][] = []

  // 基本信息
  rows.push(['学校课表总览'])
  rows.push([])
  rows.push(['学年', schedule.academicYear])
  rows.push(['学期', schedule.semester])
  rows.push(['生成时间', schedule.generatedAt.toLocaleString('zh-CN')])
  rows.push(['算法版本', schedule.algorithmVersion])
  rows.push([])
  rows.push(['班级数量', schedule.classSchedules.length])

  // 统计每个班级的课程数
  rows.push([])
  rows.push(['班级ID', '课程数', '是否有效', '冲突数'])

  for (const classSchedule of schedule.classSchedules) {
    rows.push([
      classSchedule.classId,
      classSchedule.cells.length,
      classSchedule.isValid ? '是' : '否',
      classSchedule.conflicts.length
    ])
  }

  return XLSX.utils.aoa_to_sheet(rows)
}

/**
 * 导出教师视图课表
 */
export function exportTeacherScheduleToExcel(
  schedule: SchoolSchedule,
  teachers: Teacher[]
): ArrayBuffer {
  const workbook = XLSX.utils.book_new()

  // 按教师组织课表
  const teacherCells = new Map<string, ScheduleCell[]>()

  for (const classSchedule of schedule.classSchedules) {
    for (const cell of classSchedule.cells) {
      if (!teacherCells.has(cell.teacherId)) {
        teacherCells.set(cell.teacherId, [])
      }
      teacherCells.get(cell.teacherId)!.push(cell)
    }
  }

  // 为每个教师创建课表
  for (const teacher of teachers) {
    const cells = teacherCells.get(teacher.id) || []
    const sheetName = teacher.name.substring(0, 31)
    const worksheet = createTeacherScheduleSheet(teacher, cells)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  }

  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return buffer
}

/**
 * 创建教师课表工作表
 */
function createTeacherScheduleSheet(teacher: Teacher, cells: ScheduleCell[]): XLSX.WorkSheet {
  const headers = ['节次', '周一', '周二', '周三', '周四', '周五']
  const rows: (string | number)[][] = [headers]

  // 获取动态节次配置
  const scheduleConfig = useRuleStore.getState().scheduleConfig
  const periods = scheduleConfig.periods.map(p => p.period)
  const maxPeriod = Math.max(...cells.map(c => c.period), ...periods)

  for (let period = 1; period <= maxPeriod; period++) {
    const row: (string | number)[] = [period]

    for (let day = 1; day <= 5; day++) {
      const cell = cells.find(c => c.dayOfWeek === day && c.period === period)

      if (cell) {
        const subjectName = SUBJECT_NAMES[cell.subject] || cell.subject
        row.push(`${subjectName}\n(${cell.classId})`)
      } else {
        row.push('')
      }
    }

    rows.push(row)
  }

  rows.push([])
  rows.push(['教师', teacher.name])
  rows.push(['学科', SUBJECT_NAMES[teacher.subject]])
  rows.push(['周课时', cells.length])
  rows.push(['课时上限', teacher.weeklyHoursLimit])

  const worksheet = XLSX.utils.aoa_to_sheet(rows)

  worksheet['!cols'] = [
    { wch: 8 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 }
  ]

  return worksheet
}

/**
 * 生成全新的极简一元矩阵模板Excel
 */
export function generateImportTemplate(): ArrayBuffer {
  const workbook = XLSX.utils.book_new()

  // 任课排班表模板
  const matrixTemplate = [
    ['年级', '班级名称', '班主任', '语文', '数学', '英语', '物理', '历史', '音乐'],
    ['高一', '高一1班', '张老实', '王文学', '张算数', '李外语', '赵牛顿', '钱史记', '周贝多'],
    ['高一', '高一2班', '王文学', '吴作文', '张算数', '郑语法', '孙阿基', '钱史记', '周贝多']
  ]
  const matrixSheet = XLSX.utils.aoa_to_sheet(matrixTemplate)
  
  // 设置列宽更美观
  matrixSheet['!cols'] = [
    { wch: 10 },
    { wch: 15 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
  ]
  XLSX.utils.book_append_sheet(workbook, matrixSheet, '排课名单')

  // 说明表
  const instructionTemplate = [
    ['数据导入超简明说明'],
    [],
    ['只需填写一张表格，无需复制黏贴各种长代码！'],
    [],
    ['1. 班级标识：'],
    ['   - 每一行代表一个班级，年级（如：高一）和班级名称（如：高一2班）必填。'],
    [],
    ['2. 谁教谁（任课关系）：'],
    ['   - 从第四列起是所有的学科名字。你可以自由增减列数，但请确保表头名是标准学科名称（如：语文、数学、地理等）。'],
    ['   - 在这一列，属于这个班的单元格处，填上任课老师的姓名。如果有同名老师，请加上后缀（如：李四大、李四小）。'],
    [],
    ['3. 排课规则去哪里配置：'],
    ['   - 本表极其纯净，因为所有复杂的【排几节课】、【连堂】和【禁排时间】不再需要填写在 Excel 内。'],
    ['   - 等导入本文件成功后，进入界面菜单的「排课规则」页面直接设置。系统会自动将名单和规则合成处理。'],
  ]
  const instructionSheet = XLSX.utils.aoa_to_sheet(instructionTemplate)
  XLSX.utils.book_append_sheet(workbook, instructionSheet, '阅读说明')

  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return buffer
}

/**
 * 下载Excel文件的辅助函数（浏览器环境）
 */
export function downloadExcel(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * 导出级部总课程表
 * 横向显示时间段，纵向显示班级
 */
export function exportGradeOverviewToExcel(
  schedule: SchoolSchedule,
  classes: SchoolClass[]
): ArrayBuffer {
  const workbook = XLSX.utils.book_new()
  const rows: (string | number)[][] = []

  // 获取节次配置
  const scheduleConfig = useRuleStore.getState().scheduleConfig
  const periods = scheduleConfig.periods.map(p => p.period)
  const days = ['周一', '周二', '周三', '周四', '周五']

  // 标题行
  rows.push(['级部总课程表'])
  rows.push([])
  rows.push(['生成时间：', new Date().toLocaleString('zh-CN')])
  rows.push([])

  // 表头：班级 | 周一1 | 周一2 | ... | 周五7
  const headerRow: (string | number)[] = ['班级']
  for (const day of days) {
    for (const period of periods) {
      headerRow.push(`${day}第${period}节`)
    }
  }
  rows.push(headerRow)

  // 构建数据结构
  const scheduleMap = new Map<string, Map<string, Subject>>()
  for (const classSchedule of schedule.classSchedules) {
    const cellMap = new Map<string, Subject>()
    for (const cell of classSchedule.cells) {
      cellMap.set(`${cell.dayOfWeek}_${cell.period}`, cell.subject)
    }
    scheduleMap.set(classSchedule.classId, cellMap)
  }

  // 数据行
  for (const cls of classes) {
    const classRow: (string | number)[] = [cls.name]
    const cellMap = scheduleMap.get(cls.id)

    for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
      for (const period of periods) {
        const cellKey = `${dayIndex + 1}_${period}`
        const subject = cellMap?.get(cellKey)
        classRow.push(subject ? (SUBJECT_NAMES[subject] || subject) : '')
      }
    }

    rows.push(classRow)
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows)

  // 设置列宽
  const cols = [{ wch: 12 }] // 班级列
  for (let i = 0; i < 5 * periods.length; i++) {
    cols.push({ wch: 8 })
  }
  worksheet['!cols'] = cols

  // 设置打印选项
  worksheet['!pageSetup'] = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, '级部总表')

  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return buffer
}

/**
 * 导出所有班级课表（单个Sheet，每个班级一个表格）
 */
export function exportAllClassSchedules(
  schedule: SchoolSchedule,
  classes: SchoolClass[],
  teachers: Teacher[]
): ArrayBuffer {
  const workbook = XLSX.utils.book_new()
  const rows: (string | number)[][] = []

  // 获取节次配置
  const scheduleConfig = useRuleStore.getState().scheduleConfig
  const periods = scheduleConfig.periods.map(p => p.period)
  const days = ['周一', '周二', '周三', '周四', '周五']

  // 教师ID到姓名的映射
  const teacherNameMap = new Map<string, string>()
  for (const teacher of teachers) {
    teacherNameMap.set(teacher.id, teacher.name)
    teacherNameMap.set(teacher.employeeId, teacher.name)
  }

  // 标题
  rows.push(['班级课表汇总'])
  rows.push(['生成时间：', new Date().toLocaleString('zh-CN')])
  rows.push([])

  // 为每个班级生成课表
  for (const cls of classes) {
    const classSchedule = schedule.classSchedules.find(s => s.classId === cls.id)
    if (!classSchedule) continue

    // 班级标题
    rows.push([])
    rows.push([`${cls.name} 课表`])
    rows.push([])

    // 表头
    rows.push(['节次', ...days])

    // 构建单元格映射
    const cellMap = new Map<string, ScheduleCell>()
    for (const cell of classSchedule.cells) {
      cellMap.set(`${cell.dayOfWeek}_${cell.period}`, cell)
    }

    // 数据行
    for (const period of periods) {
      const row: (string | number)[] = [`第${period}节`]
      for (let day = 1; day <= 5; day++) {
        const cell = cellMap.get(`${day}_${period}`)
        if (cell) {
          const subjectName = SUBJECT_NAMES[cell.subject] || cell.subject
          const teacherName = teacherNameMap.get(cell.teacherId) || cell.teacherId
          row.push(`${subjectName}\n(${teacherName})`)
        } else {
          row.push('')
        }
      }
      rows.push(row)
    }
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows)

  // 设置列宽
  worksheet['!cols'] = [
    { wch: 8 },  // 节次
    { wch: 14 }, // 周一
    { wch: 14 }, // 周二
    { wch: 14 }, // 周三
    { wch: 14 }, // 周四
    { wch: 14 }  // 周五
  ]

  // 设置打印选项
  worksheet['!pageSetup'] = {
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, '班级课表')

  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return buffer
}

/**
 * 导出所有教师课表（单个Sheet，每个教师一个表格）
 */
export function exportAllTeacherSchedules(
  schedule: SchoolSchedule,
  teachers: Teacher[],
  classes: SchoolClass[]
): ArrayBuffer {
  const workbook = XLSX.utils.book_new()
  const rows: (string | number)[][] = []

  // 获取节次配置
  const scheduleConfig = useRuleStore.getState().scheduleConfig
  const periods = scheduleConfig.periods.map(p => p.period)
  const days = ['周一', '周二', '周三', '周四', '周五']

  // 班级ID到名称的映射
  const classNameMap = new Map<string, string>()
  for (const cls of classes) {
    classNameMap.set(cls.id, cls.name)
  }

  // 按学科分组教师
  const teachersBySubject = new Map<string, Teacher[]>()
  for (const teacher of teachers) {
    const subject = teacher.subject
    if (!teachersBySubject.has(subject)) {
      teachersBySubject.set(subject, [])
    }
    teachersBySubject.get(subject)!.push(teacher)
  }

  // 标题
  rows.push(['教师课表汇总'])
  rows.push(['生成时间：', new Date().toLocaleString('zh-CN')])
  rows.push([])

  // 构建教师课表映射
  const teacherScheduleMap = new Map<string, Map<string, ScheduleCell>>()
  for (const classSchedule of schedule.classSchedules) {
    for (const cell of classSchedule.cells) {
      if (!teacherScheduleMap.has(cell.teacherId)) {
        teacherScheduleMap.set(cell.teacherId, new Map())
      }
      teacherScheduleMap.get(cell.teacherId)!.set(`${cell.dayOfWeek}_${cell.period}`, cell)
    }
  }

  // 按学科遍历教师
  const sortedSubjects = Array.from(teachersBySubject.keys()).sort()
  for (const subject of sortedSubjects) {
    const subjectTeachers = teachersBySubject.get(subject)!
    const subjectName = SUBJECT_NAMES[subject as Subject] || subject

    // 学科分组标题
    rows.push([])
    rows.push([`【${subjectName}】`])

    for (const teacher of subjectTeachers) {
      const cellMap = teacherScheduleMap.get(teacher.id)
      const weeklyHours = cellMap?.size || 0

      // 教师标题
      rows.push([])
      rows.push([`${teacher.name} 课表  （周课时：${weeklyHours}节）`])
      rows.push([])

      // 表头
      rows.push(['节次', ...days])

      // 数据行
      for (const period of periods) {
        const row: (string | number)[] = [`第${period}节`]
        for (let day = 1; day <= 5; day++) {
          const cell = cellMap?.get(`${day}_${period}`)
          if (cell) {
            const subjectName = SUBJECT_NAMES[cell.subject] || cell.subject
            const className = classNameMap.get(cell.classId) || cell.classId
            row.push(`${subjectName}\n(${className})`)
          } else {
            row.push('')
          }
        }
        rows.push(row)
      }
    }
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows)

  // 设置列宽
  worksheet['!cols'] = [
    { wch: 8 },  // 节次
    { wch: 16 }, // 周一
    { wch: 16 }, // 周二
    { wch: 16 }, // 周三
    { wch: 16 }, // 周四
    { wch: 16 }  // 周五
  ]

  // 设置打印选项
  worksheet['!pageSetup'] = {
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, '教师课表')

  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return buffer
}
