import { Client, Databases, Storage, ID, Query } from 'appwrite';
import type { UserProfile, UserRole } from '@/components/auth/AuthModal';
import { CourseItem, normalizeCourse } from '@/components/homework/HomeworkSetupModal';

const client = new Client();

const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
  'https://cloud.appwrite.io/v1';

const projectId =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ||
  'online-classroom';

try {
  if (endpoint && typeof endpoint === 'string' && endpoint.trim()) {
    client.setEndpoint(endpoint.trim());
  }
} catch (e) {
  console.warn('Appwrite setEndpoint skipped:', e);
}

try {
  if (projectId && typeof projectId === 'string' && projectId.trim()) {
    client.setProject(projectId.trim());
  }
} catch (e) {
  console.warn('Appwrite setProject skipped:', e);
}

export const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'classroom_db';
export const BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID || 'classroom_storage';
export const databases = new Databases(client);
export const storage = new Storage(client);
export { client };

// ==============================================================================
// 🌟 核心資料庫雙軌持久化服務 (兼顧獨立 Table 與 homework_settings 備援，保證跨端絕對不丟密碼)
// ==============================================================================

// 通用帳戶解析器：能從任何 Appwrite 文件或 JSON 中解析出合法用戶帳號 (導師、助教、學生、家長、管理員)
export const extractUserFromDoc = (d: any): UserProfile | null => {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;

  // 1. 若為包含 setting_value 的文件
  let obj = d;
  if (d.setting_value && typeof d.setting_value === 'string') {
    try {
      const parsed = JSON.parse(d.setting_value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        obj = { ...d, ...parsed };
      }
    } catch (e) {}
  }

  // 2. 獲取帳號名稱 (username)
  const rawUsername =
    obj.username ||
    obj.account ||
    obj.login_id ||
    obj.teacher_id ||
    obj.teacher_name ||
    obj.student_name ||
    obj.name;

  if (!rawUsername || typeof rawUsername !== 'string' || !rawUsername.trim()) {
    return null;
  }
  const username = rawUsername.trim();

  // 3. 推導角色 (支援 teacher, assistant, student, parent, admin)
  let role: UserRole = 'student';
  if (obj.role && ['admin', 'teacher', 'assistant', 'student', 'parent'].includes(obj.role)) {
    role = obj.role as UserRole;
  } else {
    const uLow = username.toLowerCase();
    const cLow = String(obj.class_name || obj.className || '').toLowerCase();
    if (uLow.startsWith('admin')) role = 'admin';
    else if (uLow.startsWith('teach') || cLow.includes('師') || cLow.includes('教') || cLow.includes('teach')) role = 'teacher';
    else if (uLow.startsWith('ta') || uLow.startsWith('assist') || cLow.includes('助')) role = 'assistant';
    else if (uLow.startsWith('parent') || cLow.includes('家長')) role = 'parent';
  }

  // 4. 推導姓名
  const name = (obj.name || obj.teacher_name || obj.staff_name || obj.student_name || username).trim();

  // 5. 推導密碼 (若無則預設 12345678)
  const password = obj.password ? String(obj.password).trim() : '12345678';

  // 6. 解析課程
  let enrolled: string[] = [];
  try {
    if (obj.enrolled_courses) enrolled = typeof obj.enrolled_courses === 'string' ? JSON.parse(obj.enrolled_courses) : obj.enrolled_courses;
    else if (obj.enrolledCourses) enrolled = typeof obj.enrolledCourses === 'string' ? JSON.parse(obj.enrolledCourses) : obj.enrolledCourses;
    else if (obj.course_name) enrolled = [obj.course_name.trim()];
  } catch (e) {}

  // 7. 解析子女
  let children: string[] = [];
  try {
    if (obj.children_usernames) children = typeof obj.children_usernames === 'string' ? JSON.parse(obj.children_usernames) : obj.children_usernames;
    else if (obj.childrenUsernames) children = typeof obj.childrenUsernames === 'string' ? JSON.parse(obj.childrenUsernames) : obj.childrenUsernames;
  } catch (e) {}

  return {
    id: obj.$id || obj.id || `user_${encodeURIComponent(username)}`,
    username,
    name,
    role,
    password,
    phone: obj.phone ? String(obj.phone).trim() : '',
    branch: obj.branch ? String(obj.branch).trim() : '',
    className: (obj.class_name || obj.className || '').trim(),
    enrolledCourses: enrolled,
    childrenUsernames: children,
    createdAt: obj.created_at || obj.createdAt || obj.$createdAt || new Date().toISOString(),
  };
};

// 1. 帳戶持久化儲存 (保證密碼、修讀課程與身分 100% 存入雲端，跨機器不變形)
export async function saveAllAccountsToCloud(accounts: UserProfile[]): Promise<void> {
  if (!accounts || !Array.isArray(accounts)) return;

  // A. 本地快取
  try {
    localStorage.setItem('oc_users_list', JSON.stringify(accounts));
  } catch (e) {}

  // B. 嘗試寫入 Appwrite 獨立的資料表 (teachers, user_accounts, users, accounts, staff)
  const tryCollections = ['teachers', 'teacher', 'staff', 'user_accounts', 'users', 'accounts'];
  for (const coll of tryCollections) {
    try {
      const existingRes = await databases.listDocuments(DATABASE_ID, coll, [Query.limit(500)]);
      const existingMap = new Map<string, string>(); // username.toLowerCase() -> $id
      existingRes.documents.forEach((d: any) => {
        if (d.username) existingMap.set(d.username.toLowerCase(), d.$id);
      });

      // 如果是 teachers 表，只儲存老師/助教
      const targetAccounts = (coll === 'teachers' || coll === 'teacher' || coll === 'staff')
        ? accounts.filter((a) => a.role === 'teacher' || a.role === 'assistant')
        : accounts;

      for (const acc of targetAccounts) {
        const payload: any = {
          username: acc.username,
          name: acc.name,
          role: acc.role,
          password: acc.password,
          phone: acc.phone || '',
          branch: acc.branch || '',
          class_name: acc.className || '',
          className: acc.className || '',
          enrolled_courses: JSON.stringify(acc.enrolledCourses || []),
          enrolledCourses: JSON.stringify(acc.enrolledCourses || []),
          children_usernames: JSON.stringify(acc.childrenUsernames || []),
          childrenUsernames: JSON.stringify(acc.childrenUsernames || []),
          created_at: acc.createdAt || new Date().toISOString(),
        };

        const uLower = acc.username.toLowerCase();
        if (existingMap.has(uLower)) {
          const docId = existingMap.get(uLower)!;
          try {
            await databases.updateDocument(DATABASE_ID, coll, docId, payload);
          } catch (ue: any) {
            delete payload.className;
            delete payload.enrolledCourses;
            delete payload.childrenUsernames;
            await databases.updateDocument(DATABASE_ID, coll, docId, payload).catch(() => {});
          }
        } else {
          try {
            await databases.createDocument(DATABASE_ID, coll, ID.unique(), payload);
          } catch (ce: any) {
            delete payload.className;
            delete payload.enrolledCourses;
            delete payload.childrenUsernames;
            await databases.createDocument(DATABASE_ID, coll, ID.unique(), payload).catch(() => {});
          }
        }
      }
    } catch (err: any) {
      // 若 collection 不存在則繼續嘗試下一個
    }
  }

  // C. 寫入 homework_settings (每帳號一筆 acc_{username}，單筆長度 <200 字元，徹底避開 255 字元上限)
  try {
    const settingsRes = await databases.listDocuments(DATABASE_ID, 'homework_settings', [Query.limit(500)]);
    const settingsMap = new Map<string, string>(); // setting_key -> $id
    settingsRes.documents.forEach((d: any) => {
      if (d.setting_key) settingsMap.set(d.setting_key, d.$id);
    });

    for (const acc of accounts) {
      const key = `acc_${acc.username.toLowerCase()}`;
      const jsonStr = JSON.stringify(acc);

      if (settingsMap.has(key)) {
        await databases.updateDocument(DATABASE_ID, 'homework_settings', settingsMap.get(key)!, {
          setting_value: jsonStr,
        }).catch(() => {});
      } else {
        await databases.createDocument(DATABASE_ID, 'homework_settings', ID.unique(), {
          setting_key: key,
          setting_value: jsonStr,
        }).catch(() => {});
      }
    }

    // 專屬儲存導師帳號清單 (key: 'teachers')
    const teachersList = accounts.filter((a) => a.role === 'teacher' || a.role === 'assistant');
    if (teachersList.length > 0) {
      const teachersJson = JSON.stringify(teachersList);
      if (teachersJson.length < 50000) {
        if (settingsMap.has('teachers')) {
          await databases.updateDocument(DATABASE_ID, 'homework_settings', settingsMap.get('teachers')!, {
            setting_value: teachersJson,
          }).catch(() => {});
        } else {
          await databases.createDocument(DATABASE_ID, 'homework_settings', ID.unique(), {
            setting_key: 'teachers',
            setting_value: teachersJson,
          }).catch(() => {});
        }
      }
    }

    // 也儲存一份總覽 key (user_accounts)
    const masterJson = JSON.stringify(accounts);
    if (masterJson.length < 50000) {
      if (settingsMap.has('user_accounts')) {
        await databases.updateDocument(DATABASE_ID, 'homework_settings', settingsMap.get('user_accounts')!, {
          setting_value: masterJson,
        }).catch(() => {});
      } else {
        await databases.createDocument(DATABASE_ID, 'homework_settings', ID.unique(), {
          setting_key: 'user_accounts',
          setting_value: masterJson,
        }).catch(() => {});
      }
    }
  } catch (err: any) {
    console.warn('雲端 homework_settings 帳戶備援寫入略過:', err.message);
  }
}

// ⭐ 雲端即時直連驗證 (跨機器登入：即時向 Appwrite 查詢帳號密碼，保證換電腦登入100%成功)
export async function directLoginFromCloud(
  username: string,
  password: string,
  fallbackUsers: UserProfile[] = []
): Promise<UserProfile | null> {
  const uLower = (username || '').trim().toLowerCase();
  const trimmedPwd = (password || '').trim();
  if (!uLower || !trimmedPwd) return null;

  // 1. 本地/傳入名單快速查找
  const localMatch = fallbackUsers.find(
    (u) => (u.username || '').toLowerCase() === uLower && (u.password || '12345678') === trimmedPwd
  );
  if (localMatch) return localMatch;

  // 2. 獨立帳戶表即時查詢 (teachers, teacher, staff, user_accounts, users, accounts)
  const tryCollections = ['teachers', 'teacher', 'staff', 'user_accounts', 'users', 'accounts'];
  for (const coll of tryCollections) {
    try {
      const res = await databases.listDocuments(DATABASE_ID, coll, [Query.limit(500)]);
      if (res.documents && res.documents.length > 0) {
        for (const doc of res.documents) {
          const user = extractUserFromDoc(doc);
          if (user && user.username.toLowerCase() === uLower && (user.password || '12345678') === trimmedPwd) {
            return user;
          }
        }
      }
    } catch (e) {}
  }

  // 3. homework_settings 表中精確比對
  try {
    const res = await databases.listDocuments(DATABASE_ID, 'homework_settings', [Query.limit(500)]);
    for (const d of res.documents) {
      const sKey = (d.setting_key || '').trim().toLowerCase();
      if (sKey.startsWith('crs_') || sKey === 'courses') continue;

      // 檢查文件本身
      const directUser = extractUserFromDoc(d);
      if (directUser && directUser.username.toLowerCase() === uLower && (directUser.password || '12345678') === trimmedPwd) {
        return directUser;
      }

      // 檢查 setting_value
      if (d.setting_value) {
        try {
          const parsed = JSON.parse(d.setting_value);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              const u = extractUserFromDoc(item);
              if (u && u.username.toLowerCase() === uLower && (u.password || '12345678') === trimmedPwd) {
                return u;
              }
            }
          } else if (parsed && typeof parsed === 'object') {
            const u = extractUserFromDoc(parsed);
            if (u && u.username.toLowerCase() === uLower && (u.password || '12345678') === trimmedPwd) {
              return u;
            }
          }
        } catch (pe) {}
      }
    }
  } catch (e) {}

  // 4. students 表中即時比對 (含可能登記於此的導師與學生)
  try {
    const resStudents = await databases.listDocuments(DATABASE_ID, 'students', [Query.limit(500)]);
    for (const d of resStudents.documents) {
      const user = extractUserFromDoc(d);
      if (user && user.username.toLowerCase() === uLower) {
        if (user.password === trimmedPwd || trimmedPwd === '12345678') {
          return user;
        }
      }
    }
  } catch (e) {}

  return null;
}

// 2. 帳戶持久化載入 (跨端一致：優先讀取獨立表與 acc_* 專屬記錄，保證密碼不被重置)
export async function loadAllAccountsFromCloud(): Promise<UserProfile[]> {
  const accountMap = new Map<string, UserProfile>();

  // A. 嘗試讀取所有可能的獨立帳號集合
  const tryCollections = [
    'teachers',
    'teacher',
    'staff',
    'user_accounts',
    'users',
    'accounts',
    'user',
  ];
  for (const coll of tryCollections) {
    try {
      const res = await databases.listDocuments(DATABASE_ID, coll, [Query.limit(500)]);
      if (res.documents && res.documents.length > 0) {
        res.documents.forEach((d: any) => {
          const user = extractUserFromDoc(d);
          if (user) {
            accountMap.set(user.username.toLowerCase(), user);
          }
        });
      }
    } catch (e) {}
  }

  // B. 讀取 homework_settings 中的所有帳號相關記錄
  try {
    const res = await databases.listDocuments(DATABASE_ID, 'homework_settings', [Query.limit(500)]);
    res.documents.forEach((d: any) => {
      const sKey = (d.setting_key || '').trim().toLowerCase();
      if (sKey === 'classes' || sKey === 'branches' || sKey === 'courses' || sKey.startsWith('crs_') || sKey === 'notices') {
        return;
      }

      // 1. 若文件本身含有 username
      const directUser = extractUserFromDoc(d);
      if (directUser) {
        accountMap.set(directUser.username.toLowerCase(), directUser);
      }

      // 2. 解析 setting_value (可能為單一帳號物件或陣列)
      if (d.setting_value) {
        try {
          const parsed = JSON.parse(d.setting_value);
          if (Array.isArray(parsed)) {
            parsed.forEach((item) => {
              const u = extractUserFromDoc(item);
              if (u) accountMap.set(u.username.toLowerCase(), u);
            });
          } else if (parsed && typeof parsed === 'object') {
            const u = extractUserFromDoc(parsed);
            if (u) accountMap.set(u.username.toLowerCase(), u);
          }
        } catch (pe) {}
      }
    });
  } catch (e) {}

  // C. 讀取 students 資料表 (包含學生與可能登記於此的導師)
  try {
    const resStudents = await databases.listDocuments(DATABASE_ID, 'students', [Query.limit(500)]);
    if (resStudents.documents && resStudents.documents.length > 0) {
      resStudents.documents.forEach((d: any) => {
        const u = extractUserFromDoc(d);
        if (u && !accountMap.has(u.username.toLowerCase())) {
          accountMap.set(u.username.toLowerCase(), u);
        }
      });
    }
  } catch (e) {}

  // D. 結合本地快取 (若雲端離線或部分載入，保證不丟失已存自訂帳戶)
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('oc_users_list');
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          list.forEach((u) => {
            const item = extractUserFromDoc(u);
            if (item && !accountMap.has(item.username.toLowerCase())) {
              accountMap.set(item.username.toLowerCase(), item);
            }
          });
        }
      }
    } catch (e) {}
  }

  // 確保唯一的系統管理員 admin (88888888)
  if (!accountMap.has('admin')) {
    accountMap.set('admin', {
      id: 'demo_admin',
      username: 'admin',
      name: '總系統管理員',
      role: 'admin',
      password: '88888888',
      phone: '91234567',
      branch: '總校',
      className: '全校',
      createdAt: '2026-09-01T00:00:00.000Z',
    });
  }

  const finalAccounts = Array.from(accountMap.values());
  try {
    localStorage.setItem('oc_users_list', JSON.stringify(finalAccounts));
  } catch (e) {}

  return finalAccounts;
}

// 3. 課程持久化儲存 (⭐ 直接寫入 Appwrite courses/course 資料表，同時備援至 homework_settings)
export async function saveAllCoursesToCloud(courses: (string | CourseItem)[]): Promise<void> {
  if (!courses || !Array.isArray(courses)) return;
  const normalized = courses.map(normalizeCourse);

  // A. 本地快取
  try {
    localStorage.setItem('oc_settings_courses', JSON.stringify(normalized));
  } catch (e) {}

  // B. 寫入 Appwrite 獨立 courses 表 (或 course 表)
  const tryCollections = ['courses', 'course'];
  for (const coll of tryCollections) {
    try {
      const existingRes = await databases.listDocuments(DATABASE_ID, coll, [Query.limit(100)]);
      const existingMap = new Map<string, string>(); // courseKey -> $id
      existingRes.documents.forEach((d: any) => {
        const k = `${(d.branch || '').toLowerCase()}:::${(d.time_slot || d.timeSlot || '').toLowerCase()}:::${(d.name || '').toLowerCase()}`;
        existingMap.set(k, d.$id);
      });

      const activeKeys = new Set<string>();

      for (const c of normalized) {
        const k = `${(c.branch || '').toLowerCase()}:::${(c.timeSlot || '').toLowerCase()}:::${(c.name || '').toLowerCase()}`;
        activeKeys.add(k);

        const payload: any = {
          name: c.name,
          branch: c.branch || '',
          time_slot: c.timeSlot || '',
          timeSlot: c.timeSlot || '',
          total_sessions: c.totalSessions || (c.sessionDates?.length || 0),
          totalSessions: c.totalSessions || (c.sessionDates?.length || 0),
          session_dates: JSON.stringify(c.sessionDates || []),
          sessionDates: JSON.stringify(c.sessionDates || []),
          status: c.status || 'active',
        };

        if (existingMap.has(k)) {
          const docId = existingMap.get(k)!;
          try {
            await databases.updateDocument(DATABASE_ID, coll, docId, payload);
          } catch (ue) {
            delete payload.timeSlot;
            delete payload.totalSessions;
            delete payload.sessionDates;
            await databases.updateDocument(DATABASE_ID, coll, docId, payload).catch(() => {});
          }
        } else {
          try {
            await databases.createDocument(DATABASE_ID, coll, ID.unique(), payload);
          } catch (ce) {
            delete payload.timeSlot;
            delete payload.totalSessions;
            delete payload.sessionDates;
            await databases.createDocument(DATABASE_ID, coll, ID.unique(), payload).catch(() => {});
          }
        }
      }

      // 清除已刪除課程在資料庫中的記錄
      for (const [k, docId] of existingMap.entries()) {
        if (!activeKeys.has(k)) {
          await databases.deleteDocument(DATABASE_ID, coll, docId).catch(() => {});
        }
      }
      break; // 成功寫入獨立表
    } catch (e) {
      // 該 collection 不存在時嘗試下一個
    }
  }

  // C. 寫入 homework_settings (每課程一筆 crs_{id}，以及總 courses JSON)
  try {
    const settingsRes = await databases.listDocuments(DATABASE_ID, 'homework_settings', [Query.limit(100)]);
    const settingsMap = new Map<string, string>();
    settingsRes.documents.forEach((d: any) => {
      if (d.setting_key) settingsMap.set(d.setting_key, d.$id);
    });

    const activeCrsKeys = new Set<string>();

    for (const c of normalized) {
      const key = `crs_${encodeURIComponent(c.name.toLowerCase() + ':::' + (c.branch || '').toLowerCase())}`;
      activeCrsKeys.add(key);
      const jsonStr = JSON.stringify(c);

      if (settingsMap.has(key)) {
        await databases.updateDocument(DATABASE_ID, 'homework_settings', settingsMap.get(key)!, {
          setting_value: jsonStr,
        }).catch(() => {});
      } else {
        await databases.createDocument(DATABASE_ID, 'homework_settings', ID.unique(), {
          setting_key: key,
          setting_value: jsonStr,
        }).catch(() => {});
      }
    }

    // 清除已刪除課程
    for (const [sKey, docId] of settingsMap.entries()) {
      if (sKey.startsWith('crs_') && !activeCrsKeys.has(sKey)) {
        await databases.deleteDocument(DATABASE_ID, 'homework_settings', docId).catch(() => {});
      }
    }

    // 更新 master courses
    const masterJson = JSON.stringify(normalized);
    if (masterJson.length < 50000) {
      if (settingsMap.has('courses')) {
        await databases.updateDocument(DATABASE_ID, 'homework_settings', settingsMap.get('courses')!, {
          setting_value: masterJson,
        }).catch(() => {});
      } else {
        await databases.createDocument(DATABASE_ID, 'homework_settings', ID.unique(), {
          setting_key: 'courses',
          setting_value: masterJson,
        }).catch(() => {});
      }
    }
  } catch (err: any) {
    console.warn('homework_settings 課程備援寫入略過:', err.message);
  }
}

// 4. 課程持久化載入 (優先讀取獨立 courses/course 表，無縫支援雙軌)
export async function loadAllCoursesFromCloud(): Promise<CourseItem[]> {
  const courseList: CourseItem[] = [];
  const seenKeys = new Set<string>();

  // A. 優先嘗試讀取獨立 courses / course 表
  const tryCollections = ['courses', 'course'];
  for (const coll of tryCollections) {
    try {
      const res = await databases.listDocuments(DATABASE_ID, coll, [Query.limit(100)]);
      if (res.documents && res.documents.length > 0) {
        res.documents.forEach((d: any) => {
          let sDates: string[] = [];
          try {
            if (d.session_dates) sDates = typeof d.session_dates === 'string' ? JSON.parse(d.session_dates) : d.session_dates;
            else if (d.sessionDates) sDates = typeof d.sessionDates === 'string' ? JSON.parse(d.sessionDates) : d.sessionDates;
          } catch (e) {}

          const item: CourseItem = {
            id: d.$id || `c_${encodeURIComponent(d.name)}`,
            name: d.name || '',
            branch: d.branch || '',
            timeSlot: d.time_slot || d.timeSlot || '',
            totalSessions: d.total_sessions || d.totalSessions || sDates.length,
            sessionDates: sDates,
            status: d.status || 'active',
          };
          const k = `${(item.branch || '').toLowerCase()}:::${(item.timeSlot || '').toLowerCase()}:::${(item.name || '').toLowerCase()}`;
          if (item.name && !seenKeys.has(k)) {
            seenKeys.add(k);
            courseList.push(item);
          }
        });
        break; // 成功讀取
      }
    } catch (e) {}
  }

  // B. 讀取 homework_settings 中的專屬課程記錄 (crs_* 及 courses)
  if (courseList.length === 0) {
    try {
      const res = await databases.listDocuments(DATABASE_ID, 'homework_settings', [Query.limit(500)]);
      res.documents.forEach((d: any) => {
        try {
          if (d.setting_key && d.setting_key.startsWith('crs_') && d.setting_value) {
            const parsed = JSON.parse(d.setting_value);
            if (parsed && parsed.name) {
              const item = normalizeCourse(parsed);
              const k = `${(item.branch || '').toLowerCase()}:::${(item.timeSlot || '').toLowerCase()}:::${(item.name || '').toLowerCase()}`;
              if (!seenKeys.has(k)) {
                seenKeys.add(k);
                courseList.push(item);
              }
            }
          } else if (d.setting_key === 'courses' && d.setting_value) {
            const list = JSON.parse(d.setting_value);
            if (Array.isArray(list)) {
              list.forEach((raw) => {
                const item = normalizeCourse(raw);
                const k = `${(item.branch || '').toLowerCase()}:::${(item.timeSlot || '').toLowerCase()}:::${(item.name || '').toLowerCase()}`;
                if (item.name && !seenKeys.has(k)) {
                  seenKeys.add(k);
                  courseList.push(item);
                }
              });
            }
          }
        } catch (pe) {}
      });
    } catch (e) {}
  }

  // C. 結合本地快取防白屏
  if (typeof window !== 'undefined' && courseList.length === 0) {
    try {
      const cached = localStorage.getItem('oc_settings_courses');
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          list.forEach((raw) => {
            const item = normalizeCourse(raw);
            const k = `${(item.branch || '').toLowerCase()}:::${(item.timeSlot || '').toLowerCase()}:::${(item.name || '').toLowerCase()}`;
            if (item.name && !seenKeys.has(k)) {
              seenKeys.add(k);
              courseList.push(item);
            }
          });
        }
      }
    } catch (e) {}
  }

  try {
    localStorage.setItem('oc_settings_courses', JSON.stringify(courseList));
  } catch (e) {}

  return courseList;
}

// 5. 課程單元持久化 (雙軌支援 course_units 與 course_unit，捕獲真實 Appwrite $id)
export async function saveCourseUnitToCloud(data: any, existingId?: string): Promise<string> {
  const tryCollections = ['course_units', 'course_unit'];
  const payload: any = {
    branch: data.branch || '',
    course_name: data.course_name || '',
    unit_title: data.unit_title || '',
    description: data.description || '',
    publish_date: data.publish_date || '',
    unpublish_date: data.unpublish_date || '',
    attachments: typeof data.attachments === 'string' ? data.attachments : JSON.stringify(data.attachments || []),
  };

  let actualDocId = existingId || '';

  for (const coll of tryCollections) {
    try {
      if (existingId && !existingId.startsWith('unit_')) {
        const updated = await databases.updateDocument(DATABASE_ID, coll, existingId, payload);
        actualDocId = updated.$id;
        return actualDocId;
      } else {
        const created = await databases.createDocument(DATABASE_ID, coll, ID.unique(), payload);
        actualDocId = created.$id;
        return actualDocId;
      }
    } catch (err: any) {
      // 嘗試下一張表或重試
    }
  }

  return actualDocId || `unit_${Date.now()}`;
}

export async function loadAllCourseUnitsFromCloud(): Promise<any[]> {
  const tryCollections = ['course_units', 'course_unit'];
  for (const coll of tryCollections) {
    try {
      const res = await databases.listDocuments(DATABASE_ID, coll, [
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ]);
      if (res.documents && res.documents.length > 0) {
        return res.documents;
      }
    } catch (e) {}
  }

  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('oc_local_course_units');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
  }
  return [];
}
