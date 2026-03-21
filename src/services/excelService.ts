import * as XLSX from 'xlsx'
import { Teacher } from '@/types/teacher.types'
import { SchoolClass } from '@/types/class.types'
import { CurriculumItem } from '@/types/curriculum.types'
import { ScheduleCell, SchoolSchedule, ClassSchedule } from '@/types/schedule.types'
import { parseTeacherExcel } from '@/parsers/teacherParser'
import { parseClassExcel as parseClassSheet } from '@/parsers/classParser'
import { parseCurriculumExcel } from '@/parsers/curriculumParser'
import { SUBJECT_NAMES, DEFAULT_PERIODS } from '@/data/constants'

/**
 * Excel 导入导出服务
 */

/**
 * 导入数据结构
 */
export interface ImportResult {
  teachers: Teacher[]
  classes: SchoolClass[]
  curriculumItems: CurriculumItem[]
  errors: string[]
  warnings: string[]
}

/**
 * 从Excel文件导入所有数据
 */
export function importFromExcel(buffer: ArrayBuffer): ImportResult {
  const errors: string[] = []
  const warnings: string[] = []

  console.log('[ExcelService] Starting import, buffer size:', buffer.byteLength)
  const workbook = XLSX.read(buffer, { type: 'array' })
  console.log('[ExcelService] Workbook sheets:', workbook.SheetNames)

  // 解析教师数据
  let teachers: Teacher[] = []
  const teacherSheet = workbook.Sheets['教师'] || workbook.Sheets['teachers'] || workbook.Sheets[workbook.SheetNames[0]]
  if (teacherSheet) {
    try {
      teachers = parseTeacherExcel(teacherSheet)
      console.log('[ExcelService] Parsed teachers:', teachers.length)
    } catch (error) {
      console.error('[ExcelService] Teacher parse error:', error)
      errors.push(`解析教师数据失败: ${error}`)
    }
  } else {
    console.warn('[ExcelService] No teacher sheet found')
  }

  // 解析班级数据
  let classes: SchoolClass[] = []
  const classSheet = workbook.Sheets['班级'] || workbook.Sheets['classes'] || workbook.Sheets[workbook.SheetNames[1]]
  if (classSheet) {
    try {
      classes = parseClassSheet(classSheet)
      console.log('[ExcelService] Parsed classes:', classes.length)
    } catch (error) {
      console.error('[ExcelService] Class parse error:', error)
      errors.push(`解析班级数据失败: ${error}`)
    }
  } else {
    console.warn('[ExcelService] No class sheet found')
  }

  // 解析教学计划数据
  let curriculumItems: CurriculumItem[] = []
  const curriculumSheet = workbook.Sheets['教学计划'] || workbook.Sheets['curriculum'] || workbook.Sheets[workbook.SheetNames[2]]
  if (curriculumSheet) {
    try {
      // 构建班级名称到ID的映射
      const classIdMap = new Map<string, string>()
      for (const cls of classes) {
        classIdMap.set(cls.name, cls.id)
      }
      console.log('[ExcelService] Class ID map:', Array.from(classIdMap.entries()))

      // 构建教师工号到ID的映射
      const teacherIdMap = new Map<string, string>()
      for (const teacher of teachers) {
        teacherIdMap.set(teacher.employeeId, teacher.id)
      }
      console.log('[ExcelService] Teacher ID map:', Array.from(teacherIdMap.entries()))

      curriculumItems = parseCurriculumExcel(curriculumSheet, classIdMap, teacherIdMap)
      console.log('[ExcelService] Parsed curriculum items:', curriculumItems.length)
    } catch (error) {
      console.error('[ExcelService] Curriculum parse error:', error)
      errors.push(`解析教学计划数据失败: ${error}`)
    }
  } else {
    console.warn('[ExcelService] No curriculum sheet found')
  }

  console.log('[ExcelService] Import result:', { teachers: teachers.length, classes: classes.length, curriculumItems: curriculumItems.length, errors, warnings })

  return {
    teachers,
    classes,
    curriculumItems,
    errors,
    warnings
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
 * 生成导入模板Excel
 */
export function generateImportTemplate(): ArrayBuffer {
  const workbook = XLSX.utils.book_new()

  // 教师表模板
  const teacherTemplate = [
    ['工号', '姓名', '任教学科', '周课时上限', '避开时段', '电话', '邮箱', '备注'],
    ['T001', '张三', '数学', 20, '', '13800138000', 'zhangsan@school.edu', ''],
    ['T002', '李四', '语文', 18, '周一1,周五5', '', '', '不排早读']
  ]
  const teacherSheet = XLSX.utils.aoa_to_sheet(teacherTemplate)
  XLSX.utils.book_append_sheet(workbook, teacherSheet, '教师')

  // 班级表模板
  const classTemplate = [
    ['班级名称', '年级', '班号', '学生人数', '教室', '班主任工号', '备注'],
    ['高一(1)班', '高一', 1, 45, 'A101', 'T001', ''],
    ['高一(2)班', '高一', 2, 42, 'A102', 'T002', '']
  ]
  const classSheet = XLSX.utils.aoa_to_sheet(classTemplate)
  XLSX.utils.book_append_sheet(workbook, classSheet, '班级')

  // 教学计划表模板
  const curriculumTemplate = [
    ['班级名称', '学科', '教师工号', '周课时数', '是否连堂', '连堂节数', '固定时段', '优先级', '备注'],
    ['高一(1)班', '数学', 'T001', 5, '是', 2, '', 10, ''],
    ['高一(1)班', '语文', 'T002', 5, '', '', '', '', ''],
    ['高一(1)班', '英语', 'T003', 4, '', '', '周一1', '', '固定早读']
  ]
  const curriculumSheet = XLSX.utils.aoa_to_sheet(curriculumTemplate)
  XLSX.utils.book_append_sheet(workbook, curriculumSheet, '教学计划')

  // 说明表
  const instructionTemplate = [
    ['数据导入说明'],
    [],
    ['1. 教师表字段说明:'],
    ['   - 工号: 唯一标识'],
    ['   - 姓名: 教师姓名'],
    ['   - 任教学科: 语文/数学/英语/物理/化学/生物/历史/地理/政治/体育/音乐/美术/计算机'],
    ['   - 周课时上限: 默认20节'],
    ['   - 避开时段: 格式如 "周一1,周二2" 或 "1-1,2-2"'],
    [],
    ['2. 班级表字段说明:'],
    ['   - 年级: 一年级~高三'],
    ['   - 班号: 班级序号'],
    [],
    ['3. 教学计划表字段说明:'],
    ['   - 是否连堂: 是/否'],
    ['   - 固定时段: 格式如 "周一1"'],
    ['   - 优先级: 数值越大越优先排课']
  ]
  const instructionSheet = XLSX.utils.aoa_to_sheet(instructionTemplate)
  XLSX.utils.book_append_sheet(workbook, instructionSheet, '说明')

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
