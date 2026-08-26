window.MAQLAMA_ENV = {
  SUPABASE_URL: 'https://jzayxjeijzfikkszwqqc.supabase.co',
  SUPABASE_KEY: 'sb_publishable_U4_lkNNYBFFa5CnaqHVnPg_vJNxlGlU',
  STORAGE_BUCKET: 'maqlama',
  STORAGE_LESSON_BUCKET: 'maqlama-lessons', // خاص وسري لملفات المحاضرات (فيديو/ريكورد/ملفات) - يُنشأ تلقائياً من supabase.sql
  AUTH_DOMAIN: 'maqlama.local'
  // ملاحظة أمنية: لا تضع أي بيانات دخول افتراضية (اسم مستخدم/كلمة مرور) هنا.
  // هذا الملف يُخدَّم للمتصفح كنص عادي يمكن لأي زائر قراءته، فأي بيانات دخول
  // مكتوبة هنا تُعتبر مُسرَّبة فوراً. أنشئ حساب الأدمن من Supabase مباشرة
  // (auth.admin.createUser عبر SQL Editor أو Edge Function admin-users)
  // بكلمة مرور قوية خاصة بك — راجع SUPABASE_SETUP.md / README.md.
};