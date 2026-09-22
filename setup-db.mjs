import { Client, Databases, Permission, Role } from 'node-appwrite';

const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject('online-classroom')
  .setKey('standard_f07f8664da8c0ce665665d4aa938ea17e801450c82e3244d5a2e6efdcccf1bae8c1ea08805ff60a17799a9f4561de796721dde4162bf350eaf8faf58f975e093f4f41efd279631371c91efebbd633ccbec1e9eaa5bf8f7450235ab4159a0e73dbb93052df47dcea2f0fd556056731113936f5072fe20c371cd579efe2ff82586');

const databases = new Databases(client);
const DATABASE_ID = 'classroom_db';

const schema = [
  {
    tableId: 'profiles',
    name: '用戶資料 (Profiles)',
    columns: [
      { type: 'string', key: 'user_id', size: 64, required: true },
      { type: 'string', key: 'full_name', size: 100, required: true },
      { type: 'string', key: 'role', size: 20, required: true },
      { type: 'string', key: 'class_name', size: 20, required: false },
      { type: 'string', key: 'avatar_url', size: 500, required: false }
    ]
  },
  {
    tableId: 'notices',
    name: '電子通告 (Notices)',
    columns: [
      { type: 'string', key: 'notice_number', size: 32, required: true },
      { type: 'string', key: 'title', size: 256, required: true },
      { type: 'string', key: 'body', size: 5000, required: true },
      { type: 'datetime', key: 'deadline', required: true },
      { type: 'string', key: 'author_name', size: 100, required: true }
    ]
  },
  {
    tableId: 'notice_signatures',
    name: '通告回條簽署 (Notice Signatures)',
    columns: [
      { type: 'string', key: 'notice_id', size: 64, required: true },
      { type: 'string', key: 'user_id', size: 64, required: true },
      { type: 'boolean', key: 'signed', required: true },
      { type: 'datetime', key: 'signed_at', required: false },
      { type: 'string', key: 'reply_choice', size: 100, required: false }
    ]
  },
  {
    tableId: 'homework',
    name: '家課表 (Homework)',
    columns: [
      { type: 'string', key: 'class_name', size: 20, required: true },
      { type: 'string', key: 'subject', size: 50, required: true },
      { type: 'string', key: 'title', size: 200, required: true },
      { type: 'string', key: 'description', size: 2000, required: false },
      { type: 'datetime', key: 'due_date', required: true }
    ]
  },
  {
    tableId: 'attendance',
    name: '活動/課程點名 (Attendance)',
    columns: [
      { type: 'string', key: 'course_name', size: 100, required: true },
      { type: 'string', key: 'student_name', size: 100, required: true },
      { type: 'string', key: 'student_id', size: 64, required: true },
      { type: 'string', key: 'date', size: 20, required: true },
      { type: 'string', key: 'status', size: 20, required: true }
    ]
  }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function setup() {
  console.log('🚀 開始自動化建立 Appwrite 資料庫結構...');

  try {
    await databases.get(DATABASE_ID);
    console.log(`✅ 資料庫 [${DATABASE_ID}] 已存在`);
  } catch {
    await databases.create(DATABASE_ID, 'OnlineClassroomDB');
    console.log(`✅ 資料庫 [${DATABASE_ID}] 建立成功`);
  }

  for (const table of schema) {
    try {
      await databases.createCollection(
        DATABASE_ID,
        table.tableId,
        table.name,
        [
          Permission.read(Role.any()),
          Permission.create(Role.users()),
          Permission.update(Role.users()),
          Permission.delete(Role.users())
        ]
      );
      console.log(`\n📦 資料表 [${table.tableId}] 建立成功`);
    } catch (err) {
      console.log(`\nℹ️ 資料表 [${table.tableId}] 已存在或跳過`);
    }

    await sleep(300);

    for (const col of table.columns) {
      try {
        if (col.type === 'string') {
          await databases.createStringAttribute(
            DATABASE_ID,
            table.tableId,
            col.key,
            col.size,
            col.required
          );
        } else if (col.type === 'datetime') {
          await databases.createDatetimeAttribute(
            DATABASE_ID,
            table.tableId,
            col.key,
            col.required
          );
        } else if (col.type === 'boolean') {
          await databases.createBooleanAttribute(
            DATABASE_ID,
            table.tableId,
            col.key,
            col.required
          );
        }
        console.log(`  └─ ➕ 欄位 [${col.key}] 建立完成`);
      } catch (err) {
        console.log(`  └─ ⚠️ 欄位 [${col.key}]: ${err.message}`);
      }
      await sleep(250);
    }
  }

  console.log('\n🎉 全部資料表與欄位已在 VS Code 中一次性建立完畢！');
}

setup();