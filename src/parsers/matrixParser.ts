import * as XLSX from 'xlsx'
import { Subject, SUBJECT_NAMES } from '@/data/constants'
import { GradeLevel, GRADE_NAMES } from '@/types/class.types'
import { AggregationInput } from '@/services/ruleAggregator'

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

function parseGrade(gradeName: string): GradeLevel | null {
  const normalized = gradeName?.trim()
  if (!normalized) return null
  if (GRADE_ALIASES[normalized]) return GRADE_ALIASES[normalized]
  for (const [key, value] of Object.entries(GRADE_NAMES)) {
    if (value === normalized) return parseInt(key, 10) as GradeLevel
  }
  const numGrade = parseInt(normalized, 10)
  if (numGrade >= 1 && numGrade <= 12) return numGrade as GradeLevel
  return null
}

function parseSubject(subjectName: string): Subject | null {
  const normalizedName = subjectName?.trim()
  if (!normalizedName) return null
  for (const [key, value] of Object.entries(SUBJECT_NAMES)) {
    if (value === normalizedName) return key as Subject
  }
  return null
}

/**
 * 解析极简的二维矩阵排课表
 * 列可能为: 年级, 班级名称, 班主任, 语文, 数学, 英语...
 */
export function parseMatrixExcel(worksheet: XLSX.WorkSheet): AggregationInput {
  // raw: false 以确保获取到格式化后的字符串
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
    raw: false,
    defval: ''
  })
  
  if (jsonData.length === 0) {
    throw new Error('导入的 Excel 似乎是空的')
  }

  // 动态分析表头，找出所有可能的学科列
  const headers = Object.keys(jsonData[0])
  const subjectColumns: { header: string, subject: Subject }[] = []
  
  headers.forEach(header => {
    // 排除已知的基础字段列
    if (!['年级', '班级', '班级名称', '班号', '班主任', '序号'].includes(header.trim())) {
      const parsedSub = parseSubject(header.trim())
      if (parsedSub) {
        subjectColumns.push({ header: header.trim(), subject: parsedSub })
      }
    }
  })

  // 如果连一个学科列都找不到，抛出错误
  if (subjectColumns.length === 0) {
    throw new Error('未能从表头中识别出任何有效的学科，请检查表头名（如：语文、数学）')
  }

  const result: AggregationInput = {
    classes: [],
    assignments: []
  }

  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i]
    
    // 获取本行的核心信息
    const rawGrade = row['年级']
    const rawClassName = row['班级名称'] || row['班级'] || row['班号']
    
    // 跳过没有班级信息的行
    if (!rawGrade || !rawClassName) {
      continue
    }

    const grade = parseGrade(String(rawGrade))
    if (!grade) {
      console.warn(`第 ${i + 2} 行: 无法识别的年级 "${rawGrade}"`)
      continue
    }

    const className = String(rawClassName).trim()
    const hrTeacher = row['班主任'] ? String(row['班主任']).trim() : undefined

    // 记录班级实体基础信息
    result.classes.push({
      name: className,
      grade: grade,
      homeroomTeacherName: hrTeacher
    })

    // 遍历这行的每一个学科列（即任课关系）
    subjectColumns.forEach(subCol => {
      const rawTeacherName = row[subCol.header]
      if (rawTeacherName && String(rawTeacherName).trim() !== '') {
        const teacherNames = String(rawTeacherName).trim().split(/[,，、/ ]+/) // 可能一个班有两个老师合教，简单拆分
        teacherNames.forEach(tName => {
          if (tName) {
            result.assignments.push({
              className: className,
              grade: grade,
              subject: subCol.subject,
              teacherName: tName.trim()
            })
          }
        })
      }
    })
  }

  return result
}

export async function parseMatrixFile(filePath: string): Promise<AggregationInput> {
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0] // 默认只读第一个 sheet
  return parseMatrixExcel(workbook.Sheets[sheetName])
}

export function parseMatrixBuffer(buffer: ArrayBuffer): AggregationInput {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  return parseMatrixExcel(workbook.Sheets[sheetName])
}
