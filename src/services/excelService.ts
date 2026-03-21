import * as XLSX from 'xlsx'
import { Teacher } from '@/types/teacher.types'
import { SchoolClass } from '@/types/class.types'
import { CurriculumItem } from '@/types/curriculum.types'
import { ScheduleCell, SchoolSchedule, ClassSchedule } from '@/types/schedule.types'
import { SUBJECT_NAMES, DEFAULT_PERIODS } from '@/data/constants'
import { parseMatrixExcel } from '@/parsers/matrixParser'
import { aggregateRulesWithData, AggregationInput } from '@/services/ruleAggregator'

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

  // 按节次组织数据
  const maxPeriod = Math.max(...classSchedule.cells.map(c => c.period), DEFAULT_PERIODS.length)

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

  const maxPeriod = Math.max(...cells.map(c => c.period), DEFAULT_PERIODS.length)

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
