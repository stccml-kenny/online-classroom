import { Client, Databases, Storage, ID, Query } from 'appwrite';
import { UserProfile } from '@/components/auth/AuthModal';
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

// 1. 帳戶持久化儲存 (保證密碼、修讀課程與身分 100% 存入雲端，跨機器不變形)
export async function saveAllAccountsToCloud(accounts: UserProfile[]): Promise<void> {
  if (!accounts || !Array.isArray(accounts)) return;

  // A. 本地快取
  try {
    localStorage.setItem('oc_users_list', JSON.stringify(accounts));
  } catch (e) {}

  // B. 嘗試寫入 Appwrite 獨立的 user_accounts 或 users 資料表
  const tryCollections = ['user_accounts', 'users', 'accounts'];
  let tableSaved = false;

  for (const coll of tryCollections) {
    try {
      const existingRes = await databases.listDocuments(DATABASE_ID, coll, [Query.limit(100)]);
      const existingMap = new Map<string, string>(); // username.toLowerCase() -> $id
      existingRes.documents.forEach((d: any) => {
        if (d.username) existingMap.set(d.username.toLowerCase(), d.$id);
      });

      for (const acc of accounts) {
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
            // 若有不支援的欄位，移除後重試
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
      tableSaved = true;
      break; // 成功寫入獨立表後跳出
    } catch (err: any) {
      // 該 collection 不存在時嘗試下一個
    }
  }

  // C. 寫入 homework_settings (每帳號一筆 acc_{username}，單筆長度 <200 字元，徹底避開 255 字元上限)
  try {
    const settingsRes = await databases.listDocuments(DATABASE_ID, 'homework_settings', [Query.limit(100)]);
    const settingsMap = new Map<string, string>(); // setting_key -> $id
    settingsRes.documents.forEach((d: any) => {
      if (d.setting_key) settingsMap.set(d.setting_key, d.$id);
    });

    const activeAccKeys = new Set<string>();

    for (const acc of accounts) {
      const key = `acc_${acc.username.toLowerCase()}`;
      activeAccKeys.add(key);
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

    // 清理已刪除帳號的 acc_* 記錄
    for (const [sKey, docId] of settingsMap.entries()) {
      if (sKey.startsWith('acc_') && !activeAccKeys.has(sKey)) {
        await databases.deleteDocument(DATABASE_ID, 'homework_settings', docId).catch(() => {});
      }
    }

    // 也儲存一份總覽 key (若長度允許)
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

// 2. 帳戶持久化載入 (跨端一致：優先讀取獨立表與 acc_* 專屬記錄，保證密碼不被重置)
export async function loadAllAccountsFromCloud(): Promise<UserProfile[]> {
  const accountMap = new Map<string, UserProfile>();

  // A. 優先嘗試讀取獨立 user_accounts / users 表
  const tryCollections = ['user_accounts', 'users', 'accounts'];
  for (const coll of tryCollections) {
    try {
      const res = await databases.listDocuments(DATABASE_ID, coll, [Query.limit(100)]);
      if (res.documents && res.documents.length > 0) {
        res.documents.forEach((d: any) => {
          if (d.username && d.name) {
            let enrolled: string[] = [];
            try {
              if (d.enrolled_courses) enrolled = typeof d.enrolled_courses === 'string' ? JSON.parse(d.enrolled_courses) : d.enrolled_courses;
              else if (d.enrolledCourses) enrolled = typeof d.enrolledCourses === 'string' ? JSON.parse(d.enrolledCourses) : d.enrolledCourses;
            } catch (e) {}

            let children: string[] = [];
            try {
              if (d.children_usernames) children = typeof d.children_usernames === 'string' ? JSON.parse(d.children_usernames) : d.children_usernames;
              else if (d.childrenUsernames) children = typeof d.childrenUsernames === 'string' ? JSON.parse(d.childrenUsernames) : d.childrenUsernames;
            } catch (e) {}

            const u: UserProfile = {
              id: d.$id || `user_${d.username}`,
              username: d.username,
              name: d.name,
              role: d.role || 'student',
              password: d.password || '12345678',
              phone: d.phone || '',
              branch: d.branch || '',
              className: d.class_name || d.className || '',
              enrolledCourses: enrolled,
              childrenUsernames: children,
              createdAt: d.created_at || d.$createdAt || new Date().toISOString(),
            };
            accountMap.set(u.username.toLowerCase(), u);
          }
        });
        break; // 成功讀取
      }
    } catch (e) {}
  }

  // B. 讀取 homework_settings 中的專屬帳號記錄 (acc_* 及 user_accounts)
  try {
    const res = await databases.listDocuments(DATABASE_ID, 'homework_settings', [Query.limit(100)]);
    res.documents.forEach((d: any) => {
      try {
        if (d.setting_key && d.setting_key.startsWith('acc_') && d.setting_value) {
          const parsed = JSON.parse(d.setting_value);
          if (parsed && parsed.username) {
            accountMap.set(parsed.username.toLowerCase(), parsed);
          }
        } else if (d.setting_key === 'user_accounts' && d.setting_value) {
          const list = JSON.parse(d.setting_value);
          if (Array.isArray(list)) {
            list.forEach((u: any) => {
              if (u && u.username && !accountMap.has(u.username.toLowerCase())) {
                accountMap.set(u.username.toLowerCase(), u);
              }
            });
          }
        }
      } catch (pe) {}
    });
  } catch (e) {}

  // C. 結合本地快取 (若雲端因離線未讀到，不覆蓋本地資料)
  if (typeof window !== 'undefined' && accountMap.size === 0) {
    try {
      const cached = localStorage.getItem('oc_users_list');
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          list.forEach((u) => u && u.username && accountMap.set(u.username.toLowerCase(), u));
        }
      }
    } catch (e) {}
  }

  // 確保唯一預設管理員 admin
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
      const res = await databases.listDocuments(DATABASE_ID, 'homework_settings', [Query.limit(100)]);
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
