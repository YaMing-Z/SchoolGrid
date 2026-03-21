/**
 * 验证结果
 */
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

/**
 * 验证错误
 */
export interface ValidationError {
  code: string
  message: string
  field?: string
  value?: unknown
  suggestion?: string
}

/**
 * 验证警告
 */
export interface ValidationWarning {
  code: string
  message: string
  field?: string
  value?: unknown
}

/**
 * 数据一致性验证结果
 */
export interface ConsistencyValidationResult extends ValidationResult {
  summary: {
    totalTeachers: number
    totalClasses: number
    totalCurriculumItems: number
    teacherHoursViolations: number
    classHoursViolations: number
    missingReferences: number
  }
  details: {
    teacherHours: Map<string, { assigned: number; limit: number }>
    classHours: Map<string, { assigned: number; available: number }>
    missingTeachers: string[]
    missingClasses: string[]
  }
}

/**
 * 验证器接口
 */
export interface Validator<T> {
  validate(data: T): ValidationResult
}

/**
 * 数据完整性检查选项
 */
export interface ValidationOptions {
  checkTeacherHours: boolean      // 检查教师课时上限
  checkClassCapacity: boolean     // 检查班级课时容量
  checkReferences: boolean        // 检查引用完整性
  checkConsecutive: boolean       // 检查连堂约束
  checkAvoidSlots: boolean        // 检查避开时段
  strict: boolean                 // 严格模式（警告视为错误）
}
