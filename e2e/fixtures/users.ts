export const USERS = {
  teacher: {
    email: 'j.patel@omnisdemo.school',
    password: 'Demo1234!',
    role: 'TEACHER',
    firstName: 'J',
    lastName: 'Patel',
    school: 'Omnis Demo School',
  },
  senco: {
    email: 'r.morris@omnisdemo.school',
    password: 'Demo1234!',
    role: 'SENCO',
    firstName: 'R',
    lastName: 'Morris',
    school: 'Omnis Demo School',
  },
  slt: {
    email: 'c.roberts@omnisdemo.school',
    password: 'Demo1234!',
    role: 'SLT',
    firstName: 'Caroline',
    lastName: 'Roberts',
    school: 'Omnis Demo School',
  },
  student: {
    email: 'a.hughes@students.omnisdemo.school',
    password: 'Demo1234!',
    role: 'STUDENT',
    firstName: 'Aiden',
    lastName: 'Hughes',
    school: 'Omnis Demo School',
  },
  parent: {
    email: 'l.hughes@parents.omnisdemo.school',
    password: 'Demo1234!',
    role: 'PARENT',
    firstName: 'Laura',
    lastName: 'Hughes',
    school: 'Omnis Demo School',
  },
  schoolAdmin: {
    email: 'admin@omnisdemo.school',
    password: 'Demo1234!',
    role: 'SCHOOL_ADMIN',
    firstName: 'Admin',
    lastName: 'User',
    school: 'Omnis Demo School',
  },
  patel: {
    email: 'j.patel@omnisdemo.school',
    password: 'Demo1234!',
    role: 'TEACHER',
    firstName: 'J',
    lastName: 'Patel',
    school: 'Omnis Demo School',
  },
} as const

export type UserKey = keyof typeof USERS
export type UserFixture = (typeof USERS)[UserKey]
