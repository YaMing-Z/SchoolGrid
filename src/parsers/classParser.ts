import * as XLSX from 'xlsx'
import { GradeLevel, GRADE_NAMES, SchoolClass } from '@/types/class.types'

/**
 * Excel班级表解析器
 * 期望的Excel格式:
 * | 班级名称 | 年级 | 班号 | 学生人数 | 教室 | 班主任工号 | 备注 |
 */

interface ClassRowData {
  '班级名称': string
  '年级': string
  '班号': number | string
  '学生人数': number | string
  '教室'?: string
  '班主任工号'?: string
  '备注'?: string
}

// 扩展年级名称映射
const GRADE_ALIASES: Record<string, GradeLevel> = {
  '一年级': GradeLevel.Grade1, '1': GradeLevel.Grade1, '一': GradeLevel.Grade1,
  '二年级': GradeLevel.Grade2, '2': GradeLevel.Grade2, '二': GradeLevel.Grade2,
  '三年级': GradeLevel.Grade3, '3': GradeLevel.Grade3, '三': GradeLevel.Grade3,
  '四年级': GradeLevel.Grade4, '4': GradeLevel.Grade4, '四': GradeLevel.Grade4,
  '五年级': GradeLevel.Grade5, '5': GradeLevel.Grade5, '五': GradeLevel.Grade5,
  '六年级': GradeLevel.Grade6, '6': GradeLevel.Grade6, '六': GradeLevel.Grade6,
  '初一': GradeLevel.Grade7, '7': GradeLevel.Grade7, '七': GradeLevel.Grade7,
  '初二': GradeLevel.Grade8, '8': GradeLevel.Grade8, '八': GradeLevel.Grade8,
  '初三': GradeLevel.Grade9, '9': GradeLevel.Grade9, '九': GradeLevel.Grade9,
  '高一': GradeLevel.Grade10, '10': GradeLevel.Grade10, '十': GradeLevel.Grade10,
  '高二': GradeLevel.Grade11, '11': GradeLevel.Grade11, '十一': GradeLevel.Grade11,
  '高三': GradeLevel.Grade12, '12': GradeLevel.Grade12, '十二': GradeLevel.Grade12,
}

/**
 * 将年级名称转换为GradeLevel枚举
 */
function parseGrade(gradeName: string): GradeLevel | null {
  const normalized = gradeName?.trim()
  if (!normalized) return null

  // 先尝试别名映射
  if (GRADE_ALIASES[normalized]) {
    return GRADE_ALIASES[normalized]
  }

  // 再尝试标准映射
  for (const [key, value] of Object.entries(GRADE_NAMES)) {
    if (value === normalized) {
      return parseInt(key, 10) as GradeLevel
    }
  }

  // 尝试直接解析数字
  const numGrade = parseInt(normalized, 10)
  if (numGrade >= 1 && numGrade <= 12) {
    return numGrade as GradeLevel
  }

  return null
}

/**
 * 解析班级Excel文件
 */
export function parseClassExcel(worksheet: XLSX.WorkSheet): SchoolClass[] {
  const classes: SchoolClass[] = []
  const jsonData = XLSX.utils.sheet_to_json<ClassRowData>(worksheet, {
    raw: false,
    defval: ''
  })

  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i]

    // 跳过空行
    if (!row['班级名称']) {
      continue
    }

    const grade = parseGrade(row['年级'])
    if (!grade) {
      console.warn(`第 ${i + 2} 行: 无法识别的年级 "${row['年级']}"`)
      continue
    }

    const classNumber = parseInt(String(row['班号']), 10) || 1

    // 使用班级名称作为ID的一部分，确保唯一性
    const classId = `class_${row['班级名称']}`

    const schoolClass: SchoolClass = {
      id: classId,
      name: row['班级名称'].trim(),
      grade,
      classNumber,
      studentCount: parseInt(String(row['学生人数']), 10) || 40,
      classroom: row['教室']?.trim(),
      homeroomTeacherId: row['班主任工号']?.trim(),
      isActive: true
    }

    classes.push(schoolClass)
  }

  return classes
}

