/**
 * 年级枚举
 */
export enum GradeLevel {
  Grade1 = 1,   // 一年级
  Grade2 = 2,   // 二年级
  Grade3 = 3,   // 三年级
  Grade4 = 4,   // 四年级
  Grade5 = 5,   // 五年级
  Grade6 = 6,   // 六年级
  Grade7 = 7,   // 初一
  Grade8 = 8,   // 初二
  Grade9 = 9,   // 初三
  Grade10 = 10, // 高一
  Grade11 = 11, // 高二
  Grade12 = 12, // 高三
}

/**
 * 年级显示名称
 */
export const GRADE_NAMES: Record<GradeLevel, string> = {
  [GradeLevel.Grade1]: '一年级',
  [GradeLevel.Grade2]: '二年级',
  [GradeLevel.Grade3]: '三年级',
  [GradeLevel.Grade4]: '四年级',
  [GradeLevel.Grade5]: '五年级',
  [GradeLevel.Grade6]: '六年级',
  [GradeLevel.Grade7]: '初一',
  [GradeLevel.Grade8]: '初二',
  [GradeLevel.Grade9]: '初三',
  [GradeLevel.Grade10]: '高一',
  [GradeLevel.Grade11]: '高二',
  [GradeLevel.Grade12]: '高三',
}

/**
 * 班级实体
 */
export interface SchoolClass {
  id: string                    // 唯一标识
  name: string                  // 班级名称（如 "高一(1)班"）
  grade: GradeLevel             // 年级
  classNumber: number           // 班号
  studentCount: number          // 学生人数
  classroom?: string            // 教室位置
  homeroomTeacherId?: string    // 班主任ID
  isActive: boolean             // 是否活跃
}

/**
 * 班级创建/更新 DTO
 */
export interface SchoolClassDto {
  name: string
  grade: GradeLevel
  classNumber: number
  studentCount: number
  classroom?: string
  homeroomTeacherId?: string
}

/**
 * 班级过滤器
 */
export interface ClassFilter {
  grade?: GradeLevel
  isActive?: boolean
  searchKeyword?: string
}
