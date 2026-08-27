/* ===================================================================
 * مَقْلَمَة - منصة تعليمية
 * Supabase-first: Auth + Database + Storage + Realtime
 * يحتفظ بنفس التصميم — يطوّر الوظائف فقط.
 * =================================================================== */

/* ============== Config ============== */
const ENV = window.MAQLAMA_ENV || {};
const SUPABASE_URL = ENV.SUPABASE_URL;
const SUPABASE_KEY = ENV.SUPABASE_KEY;
const BUCKET       = ENV.STORAGE_BUCKET || 'maqlama';
const LESSON_BUCKET = ENV.STORAGE_LESSON_BUCKET || 'maqlama-lessons'; // bucket خاص (private) لملفات المحاضرات، محمي بصلاحيات حقيقية من قاعدة البيانات
const AUTH_DOMAIN  = ENV.AUTH_DOMAIN || 'maqlama.local';
const CACHE_KEY    = 'maqlama_cache_v2';

/* ===================================================================
 * جلسة الجهاز الواحد (Single Device Session)
 * كل متصفح/جهاز يولّد معرّفاً عشوائياً ثابتاً (مخزَّن في localStorage
 * الخاص به فقط) ويُرسله مع كل طلب عبر الهيدر x-device-session.
 * قاعدة البيانات (وليس هذا الملف) هي من يقرّر من الجهاز النشط فعلياً.
 * =================================================================== */
const DEVICE_ID_KEY = 'maqlama_device_id';
function getOrCreateDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // localStorage غير متاح (وضع خاص متشدد مثلاً) — نولّد معرّفاً لهذه الجلسة فقط
    return 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }
}
const DEVICE_ID = getOrCreateDeviceId();
function deviceLabel() {
  const ua = navigator.userAgent || '';
  const platform = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'جهاز محمول' : 'كمبيوتر';
  let browser = 'متصفح';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  return `${platform} - ${browser}`;
}

let sb = null;
try {
  if (window.supabase && SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes('YOUR-PROJECT')) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'maqlama_auth' },
      realtime: { params: { eventsPerSecond: 10 } },
      global: { headers: { 'x-device-session': DEVICE_ID } }
    });
  }
} catch (e) { console.error('Supabase init failed', e); }

function requireSb(){ if(!sb){ toast('Supabase غير مفعّل','عدّل env.js','error'); throw new Error('no supabase'); } return sb; }

/* ===================================================================
 * روابط التواصل الاجتماعي — عدّل الروابط من هنا فقط (مكان واحد بالكود)
 * اترك القيمة فارغة '' لأي منصة ليس لها رابط حالياً — لن تظهر أيقونتها
 * في الفوتر إلا بعد إضافة رابط حقيقي هنا.
 * مثال:
 *   facebook: 'https://facebook.com/maqlama'
 *   telegram: 'https://t.me/maqlama'
 *   whatsapp: 'https://wa.me/9665XXXXXXXX'
 * =================================================================== */
const SOCIAL_LINKS = {
    facebook:  'https://www.facebook.com/share/1D4JXED7yv/', //www.facebook.com/share/1D4JXED7yv/
  whatsapp:  'https://wa.me/01062970993', // ضع رابط واتساب هنا، مثل: https://wa.me/9665XXXXXXXX
  instagram: '', // ضع رابط الإنستغرام هنا
};

const SOCIAL_META = {
   facebook:  { label: 'فيسبوك',   icon: 'fa-brands fa-facebook-f' },
   whatsapp:  { label: 'واتساب',   icon: 'fa-brands fa-whatsapp'   },
};

/* ===================================================================
 * "اشترك الآن" — بيانات التواصل التي تظهر لأي زائر أو طالب يحاول فتح
 * كورس/مسار غير مسموح له به. عدّل الرقم أو الرابط من هنا فقط.
 * =================================================================== */
const SUBSCRIBE_CONTACT = {
  whatsappNumber:  '201062970993', // 01062970993 بصيغة دولية بدون + أو أصفار
  whatsappDisplay: '',
  facebook: 'https://www.facebook.com/share/1D4JXED7yv/',
};

/* مودال "اشترك الآن" — يظهر عند محاولة فتح كورس/مسار غير مسموح به،
 * سواء لزائر لم يسجّل الدخول أو لطالب مسجَّل غير مضاف لهذا المحتوى. */
function openSubscribeModal(name) {
  const waLink = `https://wa.me/${SUBSCRIBE_CONTACT.whatsappNumber}`;
  const fbLink = SUBSCRIBE_CONTACT.facebook;
  const body = `
    <div class="subscribe-box">
      <div class="subscribe-ic"><i class="fas fa-lock"></i></div>
      <p>${name ? `<strong>${escapeHtml(name)}</strong><br/>` : ''}هذا المحتوى غير متاح لك حالياً. تواصل معنا للاشتراك وفتح الوصول الكامل.</p>
      <div class="subscribe-actions">
        <a class="btn btn-primary" href="${escapeHtml(waLink)}" target="_blank" rel="noopener noreferrer">
          <i class="fa-brands fa-whatsapp"></i> واتساب — ${escapeHtml(SUBSCRIBE_CONTACT.whatsappDisplay)}
        </a>
        <a class="btn btn-ghost" href="${escapeHtml(fbLink)}" target="_blank" rel="noopener noreferrer">
          <i class="fa-brands fa-facebook"></i> صفحتنا على فيسبوك
        </a>
      </div>
    </div>`;
  modal({ title: 'اشترك الآن', body, footer: `<button class="btn btn-ghost" data-close>إغلاق</button>` });
}

/* ===================================================================
 * "الأقسام" — كتالوج عام (بدون تسجيل دخول) يعرض أسماء وصور كل الكورسات
 * والمسارات المتاحة على المنصة. يظهر من قائمة الـ 3 خطوط في صفحة تسجيل
 * الدخول. يعتمد على صلاحية anon محدودة في قاعدة البيانات تسمح بقراءة
 * عناوين/أوصاف/صور الكورسات والمسارات فقط — لا يوجد أي وصول من هنا إلى
 * المحاضرات أو الاختبارات أو البث أو أي محتوى فعلي.
 * =================================================================== */
let guestCatalog = { courses: null, paths: null, tab: 'courses', error: false };

function guestCardsHtml(kind, list) {
  if (guestCatalog.error) {
    return `<div class="empty"><i class="fas fa-triangle-exclamation"></i><p>تعذّر تحميل الأقسام حالياً، حاول مرة أخرى بعد قليل.</p></div>`;
  }
  if (!list || !list.length) {
    return `<div class="empty"><i class="fas fa-folder-open"></i><p>لا يوجد محتوى بعد.</p></div>`;
  }
  return `<div class="course-grid">${list.map(item => `
    <div class="${kind==='courses'?'course-card':'path-card'} is-locked" data-gid="${item.id}" data-gname="${escapeHtml(item.title)}">
      <div class="${kind==='courses'?'course-thumb':'path-thumb'}" style="background:${item.cover_image ? `url('${escapeHtml(item.cover_image)}') center/cover no-repeat` : (item.color||'linear-gradient(135deg,#4f46e5,#06b6d4)')}">
        ${item.cover_image ? '' : `<i class="fas ${item.icon||(kind==='courses'?'fa-book':'fa-route')}"></i>`}
        ${kind==='courses' ? `<span class="badge-cat">${escapeHtml(item.category||'')}</span>` : ''}
        <span class="badge-lock" title="يتطلب اشتراك"><i class="fas fa-lock"></i></span>
      </div>
      <div class="course-body">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.description||'')}</p>
      </div>
    </div>`).join('')}</div>`;
}

async function loadGuestCatalogData() {
  if (!sb) return;
  if (guestCatalog.courses === null) {
    const { data, error } = await sb.from('courses')
      .select('id,title,category,description,icon,color,cover_image')
      .order('created_at', { ascending: false });
    if (error) {
      // فشل حقيقي (غالباً صلاحيات RLS ناقصة على مشروع Supabase) — نميّزه هنا
      // عن حالة "لا توجد كورسات فعلاً" حتى يسهل تشخيصه بدل رسالة "لا يوجد
      // محتوى" المضلِّلة. راجع سياسات anon على جدولي courses/learning_paths
      // في supabase.sql (قسم PUBLIC GUEST CATALOG BROWSING / HOTFIX).
      // لا نخزّن null بشكل دائم حتى تُعاد المحاولة تلقائياً في المرة القادمة.
      console.error('guest catalog courses error', error);
      guestCatalog.error = true;
    } else {
      guestCatalog.courses = data || [];
    }
  }
  if (guestCatalog.paths === null) {
    const { data, error } = await sb.from('learning_paths')
      .select('id,title,description,icon,color,cover_image')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('guest catalog paths error', error);
      guestCatalog.error = true;
    } else {
      guestCatalog.paths = data || [];
    }
  }
}

function renderGuestCatalogBody() {
  const body = $('#guestCatalogBody');
  if (!body) return;
  const list = guestCatalog.tab === 'courses' ? guestCatalog.courses : guestCatalog.paths;
  body.innerHTML = guestCardsHtml(guestCatalog.tab, list || []);
  $$('#guestCatalogBody [data-gid]').forEach(card => {
    card.addEventListener('click', () => openSubscribeModal(card.dataset.gname));
  });
}

async function openGuestCatalog() {
  if (!sb) { toast('غير متاح حالياً', '', 'warning'); return; }
  guestCatalog.tab = 'courses';
  guestCatalog.error = false;
  const body = `
    <div class="guest-locked-hint"><i class="fas fa-circle-info"></i>
      <span>تصفّح مجاني لكل الكورسات والمسارات — الاشتراك مطلوب فقط لفتح محتواها.</span>
    </div>
    <div class="cat-tabs">
      <button type="button" class="login-tab active" data-gtab="courses">الكورسات</button>
      <button type="button" class="login-tab" data-gtab="paths">المسارات التعليمية</button>
    </div>
    <div id="guestCatalogBody"><div class="empty"><i class="fas fa-spinner fa-spin"></i><p>جارٍ التحميل...</p></div></div>`;
  const m = modal({ title: 'الأقسام', wide: true, body });
  m.root.querySelectorAll('[data-gtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      guestCatalog.tab = btn.dataset.gtab;
      m.root.querySelectorAll('[data-gtab]').forEach(x => x.classList.toggle('active', x===btn));
      renderGuestCatalogBody();
    });
  });
  await loadGuestCatalogData();
  renderGuestCatalogBody();
}

function renderFooterSocial() {
  const wrap = document.getElementById('footerSocial');
  if (!wrap) return;
  const items = Object.keys(SOCIAL_META).map(key => {
    const url = (SOCIAL_LINKS[key] || '').trim();
    const meta = SOCIAL_META[key];
    if (!url) {
      // لا يوجد رابط حقيقي بعد: نعرض الأيقونة معطّلة بدل اختراع رابط
      return `<span class="social-link disabled" title="سيتم إضافة رابط ${meta.label} قريبًا" aria-disabled="true">
        <i class="${meta.icon}"></i>
      </span>`;
    }
    return `<a class="social-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="${meta.label}" title="${meta.label}">
      <i class="${meta.icon}"></i>
    </a>`;
  }).join('');

  wrap.innerHTML = `
    <div class="footer-social-title">تواصل معنا</div>
    <div class="footer-social-icons">${items}</div>
  `;
}

/* ============== Helpers ============== */
const $  = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const fmtDate = t => new Date(t).toLocaleDateString('ar-EG', { day:'numeric', month:'short', year:'numeric' });
const fmtDateTime = t => new Date(t).toLocaleString('ar-EG', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
const fmtCountdown = ms => {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms/1000);
  const h = Math.floor(totalSec/3600);
  const m = Math.floor((totalSec%3600)/60);
  const s = totalSec%60;
  const mm = String(m).padStart(2,'0'), ss = String(s).padStart(2,'0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
const fmtTime = t => {
  const diff = Date.now() - new Date(t).getTime();
  if (diff < 60000) return 'الآن';
  if (diff < 3600000) return Math.floor(diff/60000)+' د';
  if (diff < 86400000) return Math.floor(diff/3600000)+' س';
  return fmtDate(t);
};
const escapeHtml = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// يتحقق أن الرابط http/https فعلياً قبل استخدامه كـ src/href — يمنع حقن
// روابط "javascript:" أو أي مخطط آخر قد يُنفَّذ في المتصفح (مثلاً عبر
// attachment_url في رسائل الشات، وهو حقل يقدر أي مستخدم مسجَّل تعيينه).
function safeUrl(u) {
  try {
    const url = new URL(String(u||''), location.href);
    return (url.protocol === 'http:' || url.protocol === 'https:') ? url.href : '';
  } catch { return ''; }
}
const usernameToEmail = u => u.includes('@') ? u : `${u.toLowerCase().replace(/[^a-z0-9_.]/g,'')}@${AUTH_DOMAIN}`;

function toast(title, body='', type='info') {
  const icons = { info:'fa-circle-info', success:'fa-circle-check', error:'fa-circle-exclamation', warning:'fa-triangle-exclamation' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="ic"><i class="fas ${icons[type]}"></i></div><div><strong>${escapeHtml(title)}</strong>${body?`<small>${escapeHtml(body)}</small>`:''}</div>`;
  $('#toastContainer').appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='.3s'; setTimeout(()=>el.remove(),300); }, 3500);
}

function modal({ title, body, footer='', wide=false }) {
  const root = $('#modalRoot');
  root.innerHTML = `
    <div class="modal-overlay" data-overlay>
      <div class="modal ${wide?'wide':''}">
        <div class="modal-head"><h3>${escapeHtml(title)}</h3><button class="icon-btn" data-close><i class="fas fa-xmark"></i></button></div>
        <div class="modal-body">${body}</div>
        ${footer?`<div class="modal-foot">${footer}</div>`:''}
      </div>
    </div>`;
  const close = ()=> root.innerHTML='';
  root.querySelector('[data-overlay]').addEventListener('click', e=>{ if(e.target.hasAttribute('data-overlay')) close(); });
root.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', close);
});
  return { close, root };
}

/* ============== App State ============== */
const State = {
  user: null,           // profiles row { id, username, name, role, ... }
  session: null,        // supabase session
  view: 'dashboard',
  courses: [],
  lessons: [],          // flat list
  paths: [],
  enrollments: [],      // for current user (or all if admin)
  pathEnrollments: [],
  quizzes: [],
  myQuizAttempts: [],   // current user's own quiz results
  profiles: [],         // admin: every profile. student: RLS only ever returns their own row.
  presence: {},         // uid -> online boolean (kept for backward-compat; unused now that chat is removed)
  notifications: [],
  liveStreams: [],       // active live streams the user can access (RLS already filters by course enrollment)
  settings: { theme: localStorage.getItem('maqlama_theme') || 'light' },
};

/* small cache to speed reloads (UI only) */
function cacheSave(){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify({
  courses: State.courses, paths: State.paths, profiles: State.profiles
})); }catch{} }
function cacheLoad(){ try{ const r = JSON.parse(localStorage.getItem(CACHE_KEY)||'null'); if(r){ Object.assign(State, r); } }catch{} }

/* ============== Auth ============== */
async function ensureDefaultAdmin() {
  // Admin accounts are created securely from Supabase Authentication.
  // Never auto-sign-up an account with role=admin from the browser.
  return null;
}

async function signIn(usernameOrEmail, password) {
  let email = usernameOrEmail.trim();
  if (!email.includes('@')) {
    const { data: profile, error: lookupError } = await sb
      .from('profiles').select('email').eq('username', email).maybeSingle();
    if (lookupError) throw lookupError;
    if (!profile?.email) throw new Error('اسم المستخدم غير موجود');
    email = profile.email;
  }
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  try { await sb.rpc('release_device_session', { p_device_id: DEVICE_ID }); } catch{}
  try { await sb.auth.signOut(); } catch{}
  stopSessionHeartbeat();
  State.user = null; State.session = null;
  unsubscribeAll();
  _mbTop = null;
  $('#appShell').classList.add('hidden');
  $('#loginPage').classList.remove('hidden');
  toast('تم تسجيل الخروج','','info');
}

/* ============== جلسة الجهاز الواحد: تفعيل + مراقبة ============== */
let sessionKicked = false;

// يُستدعى بعد كل دخول ناجح (طالب فقط): يحجز هذا الجهاز كجلسة نشطة
// وحيدة على مستوى القاعدة، ثم يطلب من Auth إلغاء أي جلسات (refresh
// tokens) أخرى لنفس الحساب من الخادم مباشرة — هذا هو المنع الحقيقي
// من الـ Backend، وليس مجرد إخفاء واجهة.
async function enforceSingleDeviceSession() {
  if (!State.user || State.user.role === 'admin') return; // الأدمن مستثنى عمداً
  sessionKicked = false;
  try {
    const { data, error } = await sb.rpc('claim_device_session', {
      p_device_id: DEVICE_ID, p_device_label: deviceLabel()
    });
    if (error) console.error('claim_device_session error', error);
    else if (data && data.took_over) {
      toast('تنبيه', 'كان حسابك مفتوحاً على جهاز آخر — تم إنهاء تلك الجلسة تلقائياً وتفعيل حسابك على هذا الجهاز.', 'warning');
    }
  } catch (e) { console.error('claim_device_session failed', e); }

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/session-guard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_KEY
        },
        body: JSON.stringify({ deviceId: DEVICE_ID })
      });
      if (!res.ok) console.warn('session-guard responded with', res.status);
    }
  } catch (e) {
    // لا نمنع تسجيل الدخول لو فشل استدعاء الـ Edge Function (مثلاً غير
    // منشورة بعد) — الحماية الأساسية (claim_device_session + Realtime
    // + RLS) تستمر بالعمل رغم ذلك.
    console.warn('session-guard call failed (non-fatal)', e);
  }

  startSessionHeartbeat();
}

// يُنهي الجلسة الحالية فوراً على هذا الجهاز لأن جهازاً آخر أصبح هو
// الجلسة النشطة (اكتُشف عبر Realtime أو الفحص الدوري).
async function forceKickCurrentSession(otherDeviceLabel) {
  if (sessionKicked) return;
  sessionKicked = true;
  stopSessionHeartbeat();
  try { await sb.auth.signOut(); } catch {}
  State.user = null; State.session = null;
  unsubscribeAll();
  _mbTop = null;
  $('#appShell').classList.add('hidden');
  $('#loginPage').classList.remove('hidden');
  modal({
    title: 'تم تسجيل الخروج',
    body: `<p>تم تسجيل الدخول إلى حسابك من جهاز آخر${otherDeviceLabel ? ' ('+escapeHtml(otherDeviceLabel)+')' : ''}، لذلك تم إنهاء الجلسة على هذا الجهاز تلقائياً.</p>
           <p class="muted">يسمح النظام بجلسة واحدة نشطة فقط لكل حساب طالب في نفس الوقت. يمكنك تسجيل الدخول مرة أخرى في أي وقت.</p>`,
    footer: `<button class="btn btn-primary" data-close>حسناً</button>`
  });
}

// شبكة أمان احتياطية في حال انقطع اتصال Realtime: فحص دوري كل 25
// ثانية للتأكد أن هذا الجهاز ما زال هو صاحب الجلسة النشطة.
let sessionHeartbeatTimer = null;
function startSessionHeartbeat() {
  stopSessionHeartbeat();
  sessionHeartbeatTimer = setInterval(async () => {
    if (!State.user || State.user.role === 'admin' || sessionKicked) return;
    try {
      const { data, error } = await sb.rpc('is_my_session_active', { p_device_id: DEVICE_ID });
      if (!error && data === false) await forceKickCurrentSession(null);
    } catch { /* تجاهل الأخطاء المؤقتة (انقطاع شبكة، إلخ) */ }
  }, 25000);
}
function stopSessionHeartbeat() {
  if (sessionHeartbeatTimer) { clearInterval(sessionHeartbeatTimer); sessionHeartbeatTimer = null; }
}

async function loadProfile(uid) {
  const { data, error } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error) throw error;
  return data;
}

function initLogin() {
  const menuBtn = $('#loginMenuBtn'), infoPanel = $('#loginInfoPanel');
  if (menuBtn && infoPanel) {
    menuBtn.addEventListener('click', () => {
      const open = infoPanel.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  const sectionsBtn = $('#openSectionsBtn');
  if (sectionsBtn) sectionsBtn.addEventListener('click', openGuestCatalog);
  const loginThemeBtn = $('#loginThemeToggle');
  if (loginThemeBtn) {
    loginThemeBtn.addEventListener('click', () => {
      State.settings.theme = State.settings.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('maqlama_theme', State.settings.theme);
      applyTheme();
    });
  }
  $$('.login-tab').forEach(t => t.addEventListener('click', () => {
    $$('.login-tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    const isAdmin = t.dataset.tab === 'admin';

$('#loginUser').value = '';
$('#loginPass').value = '';
    // const isAdmin = t.dataset.tab === 'admin';
    // const adm = ENV.DEFAULT_ADMIN || {};
    // $('#loginUser').value = isAdmin ? (adm.username||'admin') : '';
    // $('#loginPass').value = isAdmin ? (adm.password||'admin1234') : '';
  }));
  $$('.show-pass').forEach(b => b.addEventListener('click', () => {
    const input = $('#'+b.dataset.target);
    input.type = input.type === 'password' ? 'text' : 'password';
    b.querySelector('i').className = input.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
  }));
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!sb) { toast('Supabase غير مفعّل','يجب تعديل env.js','error'); return; }
    const u = $('#loginUser').value.trim();
    const p = $('#loginPass').value;
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; const oldHtml = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ الدخول...';
    try {
      await signIn(u, p);
      toast('أهلاً بك','تم الدخول بنجاح','success');
      await afterLogin();
    } catch(err) {
      console.error(err);
      toast('فشل الدخول', err.message || 'بيانات غير صحيحة', 'error');
    } finally { btn.disabled = false; btn.innerHTML = oldHtml; }
  });
}

async function afterLogin() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  State.session = session;
  State.user = await loadProfile(session.user.id);
  if (!State.user) { toast('خطأ','الملف الشخصي غير موجود','error'); await signOut(); return; }
  $('#loginPage').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
  $('#userName').textContent = State.user.name;
  $('#userRole').textContent = State.user.role === 'admin' ? 'مدير' : 'طالب';
  $('#userAvatar').textContent = State.user.avatar || State.user.name[0];
  $$('.admin-only').forEach(el => el.style.display = State.user.role === 'admin' ? '' : 'none');
  applyTheme();
  await enforceSingleDeviceSession();
  await Promise.all([
    loadCourses(), loadPaths(), loadProfiles(),
    loadEnrollments(), loadNotifications(), loadActiveLive(),
    loadQuizzes(), loadMyQuizAttempts()
  ]);
  subscribeGlobal();
  await setOnline(true);
  navigate('dashboard');
}

/* ============== Data loaders ============== */
async function loadCourses() {
  const { data } = await sb.from('courses').select('*').order('created_at',{ascending:false});
  State.courses = data || [];
  const { data: lessons } = await sb.from('lessons').select('*').order('position').order('created_at');
  State.lessons = lessons || [];
  cacheSave();
}
async function loadPaths() {
  const { data } = await sb.from('learning_paths').select('*').order('created_at',{ascending:false});
  State.paths = data || [];
}
async function loadProfiles() {
  const { data } = await sb.from('profiles').select('*').order('joined_at',{ascending:false});
  State.profiles = data || [];
}
async function loadQuizzes() {
  const { data, error } = await sb.from('quizzes').select('*').order('created_at',{ascending:false});
  if (error) { console.error(error); State.quizzes = []; return; }
  State.quizzes = data || [];
}
async function loadMyQuizAttempts() {
  const { data, error } = await sb.from('quiz_attempts').select('*').eq('user_id', State.user.id);
  if (error) { console.error(error); State.myQuizAttempts = []; return; }
  State.myQuizAttempts = data || [];
}
async function loadEnrollments() {
  const isAdmin = State.user.role === 'admin';
  const q1 = sb.from('enrollments').select('*');
  const q2 = sb.from('path_enrollments').select('*');
  const [{ data: e1 }, { data: e2 }] = await Promise.all([
    isAdmin ? q1 : q1.eq('user_id', State.user.id),
    isAdmin ? q2 : q2.eq('user_id', State.user.id),
  ]);
  State.enrollments = e1 || [];
  State.pathEnrollments = e2 || [];
}
async function loadNotifications() {
  try {
    const [{ data: notifications, error: notificationsError }, { data: dismissals, error: dismissalsError }] =
      await Promise.all([
        sb.from('notifications')
          .select('*')
          .or(`user_id.is.null,user_id.eq.${State.user.id}`)
          .order('created_at', { ascending: false })
          .limit(50),

        sb.from('notification_dismissals')
          .select('notification_id')
          .eq('user_id', State.user.id)
      ]);

    if (notificationsError) {
      console.error('خطأ تحميل الإشعارات:', notificationsError);
      State.notifications = [];
      renderNotifications();
      return;
    }

    if (dismissalsError) {
      console.error('خطأ تحميل الإشعارات المخفية:', dismissalsError);
      State.notifications = notifications || [];
      renderNotifications();
      return;
    }

    const dismissedIds = new Set(
      (dismissals || []).map(item => item.notification_id)
    );

    State.notifications = (notifications || []).filter(
      notification => !dismissedIds.has(notification.id)
    );

    renderNotifications();

  } catch (error) {
    console.error('Notifications error:', error);
    State.notifications = [];
    renderNotifications();
  }
}
async function loadActiveLive() {
  // الخادم (RLS) يُرجع فقط بثوث الكورسات التي الطالب مسجَّل بها فعلاً (أو
  // كل البثوث النشطة لو أدمن) — لا حاجة لأي فلترة إضافية هنا في الواجهة.
  const { data, error } = await sb.from('live_streams').select('*').eq('active', true)
    .order('started_at', { ascending: false });
  if (error) { console.error(error); State.liveStreams = []; }
  else State.liveStreams = data || [];
  $('#liveDot').style.display = State.liveStreams.length ? 'inline-block' : 'none';
}

/* ============== Realtime ============== */
let channels = [];
function unsubscribeAll(){ channels.forEach(c => { try{ sb.removeChannel(c); }catch{} }); channels = []; }

function subscribeGlobal() {
  unsubscribeAll();
  // notifications
  channels.push(sb.channel('rt:notifications')
    .on('postgres_changes', { event:'*', schema:'public', table:'notifications' }, async () => { await loadNotifications(); })
    .subscribe());
  // courses & lessons
  channels.push(sb.channel('rt:courses')
    .on('postgres_changes', { event:'*', schema:'public', table:'courses' }, async () => { await loadCourses(); if(['courses','dashboard','manageCourses'].includes(State.view)) refresh(); })
    .on('postgres_changes', { event:'*', schema:'public', table:'lessons' }, async () => { await loadCourses(); if(['courses','dashboard','manageCourses'].includes(State.view)) refresh(); })
    .subscribe());
  // enrollments (access control) — يحدّث فوراً عند تسجيل/إلغاء تسجيل الأدمن لطالب
  channels.push(sb.channel('rt:enrollments')
    .on('postgres_changes', { event:'*', schema:'public', table:'enrollments' }, async () => {
      await loadEnrollments();
      if (['courses','paths','course','dashboard','students'].includes(State.view)) refresh();
    })
    .on('postgres_changes', { event:'*', schema:'public', table:'path_enrollments' }, async () => {
      await loadEnrollments();
      if (['courses','paths','course','dashboard','students'].includes(State.view)) refresh();
    })
    .subscribe());
  // live streams
  channels.push(sb.channel('rt:live')
    .on('postgres_changes', { event:'*', schema:'public', table:'live_streams' }, async () => { await loadActiveLive(); if(State.view==='live') renderLive(); })
    .subscribe());
  // profiles (online status + مراقبة جلسة الجهاز الواحد)
  channels.push(sb.channel('rt:profiles')
    .on('postgres_changes', { event:'UPDATE', schema:'public', table:'profiles' }, async (p) => {
      const i = State.profiles.findIndex(x=>x.id===p.new.id);
      if (i>=0) State.profiles[i] = p.new;
      if (State.view==='students') renderStudents();
      // جهاز آخر أصبح هو الجلسة النشطة لهذا الحساب؟ سجّل الخروج فوراً من هنا.
      if (State.user && p.new.id === State.user.id && State.user.role !== 'admin') {
        State.user = p.new;
        if (p.new.active_session_id && p.new.active_session_id !== DEVICE_ID) {
          await forceKickCurrentSession(p.new.active_device_label);
        }
      }
    })
    .subscribe());
}

/* ============== Online presence ============== */
async function setOnline(on){
  try { await sb.from('profiles').update({ online: on, last_seen: new Date().toISOString() }).eq('id', State.user.id); } catch{}
}
window.addEventListener('beforeunload', () => { try { navigator.sendBeacon && State.user && setOnline(false); } catch{} });

/* ============== Shell ============== */
function refresh(){ navigate(State.view); }

function initShell() {
  $('#sidebarToggle').addEventListener('click', () => { $('#sidebar').classList.toggle('open'); toggleBackdrop(); });
  $('#sidebarClose').addEventListener('click', () => { $('#sidebar').classList.remove('open'); toggleBackdrop(); });
  $('#logoutBtn').addEventListener('click', signOut);
  $$('.nav-item').forEach(n => n.addEventListener('click', () => {
    navigate(n.dataset.view);
    if (window.innerWidth < 768) { $('#sidebar').classList.remove('open'); toggleBackdrop(); }
  }));
  $('#themeToggle').addEventListener('click', () => {
    State.settings.theme = State.settings.theme==='dark'?'light':'dark';
    localStorage.setItem('maqlama_theme', State.settings.theme);
    applyTheme();
  });
  $('#notifBtn').addEventListener('click', e => { e.stopPropagation(); $('#notifDropdown').classList.toggle('open'); });
  document.addEventListener('click', e => { if (!e.target.closest('.bell-wrap')) $('#notifDropdown').classList.remove('open'); });
  $('#markAllRead').addEventListener('click', async () => {
    const ids = State.notifications.filter(n=>!n.read && (n.user_id===State.user.id)).map(n=>n.id);
    if (ids.length) await sb.from('notifications').update({ read:true }).in('id', ids);
    State.notifications.forEach(n=>n.read=true);
    renderNotifications();
  });
  $('#clearAllNotifications').addEventListener('click', async () => {
  const notifications = State.notifications || [];

  if (!notifications.length) {
    toast('لا توجد إشعارات', 'لا يوجد شيء لمسحه', 'info');
    return;
  }

  const dismissals = notifications.map(notification => ({
    user_id: State.user.id,
    notification_id: notification.id
  }));

  const { error } = await sb
    .from('notification_dismissals')
    .upsert(dismissals, {
      onConflict: 'user_id,notification_id',
      ignoreDuplicates: true
    });

  if (error) {
    console.error('Clear notifications error:', error);
    toast('حدث خطأ', 'تعذر مسح الإشعارات', 'error');
    return;
  }

  State.notifications = [];
  renderNotifications();

  toast(
    'تم مسح الإشعارات',
    'تم مسح جميع الإشعارات الخاصة بك',
    'success'
  );
});
  $('#globalSearch').addEventListener('input', (e) => {
    if (State.view !== 'courses') navigate('courses');
    renderCoursesView(e.target.value);
  });
}

function toggleBackdrop() {
  let b = $('.sidebar-backdrop');
  if (!b) {
    b = document.createElement('div');
    b.className = 'sidebar-backdrop';
    b.addEventListener('click', ()=>{ $('#sidebar').classList.remove('open'); toggleBackdrop(); });
    document.body.appendChild(b);
  }
  b.classList.toggle('show', $('#sidebar').classList.contains('open'));
}
function applyTheme() {
  document.documentElement.classList.toggle('dark', State.settings.theme==='dark');
  $$('.theme-icon, #themeToggle i').forEach(ic => {
    ic.className = (ic.classList.contains('theme-icon') ? 'theme-icon ' : '') +
      (State.settings.theme==='dark' ? 'fas fa-sun' : 'fas fa-moon');
  });
}

/* ============== Mobile Back Button / Swipe-Back Bridge ==============
 * هذا المشروع صفحة واحدة (SPA) تستبدل محتوى #viewWrap مكانه، فبدون هذا
 * الجسر لا يكون لدى المتصفح أي history يتراجع فيه، وبالتالي زر الرجوع في
 * الهاتف (أو Swipe Back) يُغلق المنصة بدل الرجوع لصفحة سابقة داخلها.
 * الفكرة: كل شاشة حقيقية يفتحها الطالب (تبويب، صفحة كورس، صفحة اختبار...)
 * تسجَّل كخطوة history واحدة. عند الضغط على رجوع الهاتف:
 *   1) لو فيه Modal مفتوح أو القائمة الجانبية (موبايل) مفتوحة تُغلق أولاً.
 *   2) لو الشاشة الحالية عندها زر "رجوع" داخلي، يُضغط هو بالضبط — فتُنفَّذ
 *      نفس منطقه الأصلي حرفياً (بما في ذلك تأكيد الخروج من اختبار لم يُسلَّم
 *      بعد)، فلا يتأثر أي اختبار أو وظيفة أخرى.
 *   3) غير كده (تنقل بين التبويبات الرئيسية) تُعرض الشاشة السابقة مباشرة.
 * زر "رجوع" الموجود داخل المنصة لم يُعدَّل ولا سطر واحد فيه.
 */
let _mbTop = null; // {screen, params, sig} لآخر خطوة سجّلناها
function _mbSig(screen, params) { return screen + '|' + JSON.stringify(params || {}); }
function mbGo(screen, params) {
  const sig = _mbSig(screen, params);
  const entry = { maqlama:true, screen, params };
  try {
    if (_mbTop && _mbTop.sig === sig) history.replaceState(entry, '');
    else history.pushState(entry, '');
  } catch(e) {}
  _mbTop = { screen, params, sig };
}
function initMobileBack() {
  window.addEventListener('popstate', (e) => {
    const st = e.state;
    if (!st || !st.maqlama) return; // وصلنا لما قبل تسجيلاتنا — نترك المتصفح يتصرف بشكل طبيعي (خروج فعلي)
    if (!State.user) return;        // بعد تسجيل الخروج/قبل الدخول: لا شيء آمن لإعادة عرضه
    _mbTop = { screen: st.screen, params: st.params, sig: _mbSig(st.screen, st.params) };
    if ($('#modalRoot') && $('#modalRoot').innerHTML.trim()) $('#modalRoot').innerHTML = '';
    const sidebar = $('#sidebar');
    if (sidebar && sidebar.classList.contains('open')) { sidebar.classList.remove('open'); toggleBackdrop(); }
    const backBtn = $('#back');
    if (backBtn) { backBtn.click(); return; }
    switch (st.screen) {
      case 'tab': navigate(st.params.view); break;
      case 'course': openCourse(st.params.id); break;
      case 'quizResult': openQuizResultView(st.params.quizId, st.params.courseId); break;
      case 'manageQuizQuestions': openManageQuizQuestions(st.params.quizId); break;
      case 'quizResults': openQuizResults(st.params.quizId); break;
      case 'quizTake': openCourse(st.params.courseId); break; // لا نعيد بدء اختبار محسوب بالوقت من الـ history أبداً
      default: break;
    }
  });
}

/* ============== Navigation ============== */
function navigate(view) {
  clearQuizTimers();
  State.view = view;
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view===view));
  const wrap = $('#viewWrap'); wrap.innerHTML = '';
  const adminOnly = ['students','manageCourses','managePaths','manageQuizzes'];
  if (adminOnly.includes(view) && State.user.role !== 'admin') { toast('غير مصرح','للمدير فقط','warning'); return navigate('dashboard'); }
  mbGo('tab', { view });
  switch(view){
    case 'dashboard': renderDashboard(); break;
    case 'courses':   renderCoursesView(); break;
    case 'paths':     renderPaths(); break;
    case 'live':      renderLive(); break;
    case 'students':  renderStudents(); break;
    case 'manageCourses': renderManageCourses(); break;
    case 'managePaths':   renderManagePaths(); break;
    case 'manageQuizzes': renderManageQuizzes(); break;
    case 'profile':   renderProfile(); break;
    case 'settings':  renderSettings(); break;
  }
}

/* ============== Helpers (per-user filtering) ============== */
// كورسات/مسارات الطالب المسجَّل فيها فعلياً (تُستخدم في "كورساتي" بالرئيسية والملف الشخصي)
function visibleCourses() {
  if (State.user.role === 'admin') return State.courses;
  const ids = new Set(State.enrollments.map(e=>e.course_id));
  const pathIds = new Set(State.pathEnrollments.map(e=>e.path_id));
  return State.courses.filter(c => ids.has(c.id) || (c.path_id && pathIds.has(c.path_id)));
}
function visiblePaths() {
  if (State.user.role === 'admin') return State.paths;
  const pathIds = new Set(State.pathEnrollments.map(e=>e.path_id));
  return State.paths.filter(p => pathIds.has(p.id));
}
// كل الكورسات/المسارات الموجودة في المنصة، لعرضها كـ"كتالوج" يتصفّحه أي طالب
// (السماح بالتصفّح فقط — فتح المحتوى الفعلي يبقى محكوماً بصلاحيات RLS الحقيقية)
function catalogCourses(){ return State.courses; }
function catalogPaths(){ return State.paths; }
// هل الطالب مسجَّل فعلياً في هذا الكورس (مباشرة أو عبر مسار مسجَّل فيه)؟
function isEnrolledInCourse(c) {
  if (!c) return false;
  if (State.user.role === 'admin') return true;
  const inCourse = State.enrollments.some(e => e.course_id === c.id);
  const inPath = c.path_id && State.pathEnrollments.some(e => e.path_id === c.path_id);
  return inCourse || inPath;
}
function isEnrolledInPath(p) {
  if (!p) return false;
  if (State.user.role === 'admin') return true;
  return State.pathEnrollments.some(e => e.path_id === p.id);
}
function lessonsOf(courseId){ return State.lessons.filter(l=>l.course_id===courseId); }
function profileOf(uid){ return State.profiles.find(p=>p.id===uid); }

/* ============== Views: Dashboard ============== */
function renderDashboard() {
  const isAdmin = State.user.role === 'admin';
  // عدد الطلاب: يُحسب ويُعرض للأدمن فقط. الطالب لا يملك أصلاً وصولاً على
  // مستوى القاعدة (RLS) لأي بروفايل غير بروفايله، فهذه القيمة تكون 0
  // بالنسبة له دائماً — البطاقة نفسها تُخفى بالكامل من واجهته أدناه.
  const studentsCount = isAdmin ? State.profiles.filter(p=>p.role==='student').length : 0;
  const lessonsCount = State.lessons.length;
  const my = visibleCourses().slice(0,6);
  $('#viewWrap').innerHTML = `
    <div class="page-head">
      <div><h1>أهلاً، ${escapeHtml(State.user.name)} </h1><p>هذه نظرة سريعة على نشاطك في المنصة.</p></div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-ic"><i class="fas fa-book"></i></div><div><div class="stat-val">${State.courses.length}</div><div class="stat-lbl">الكورسات</div></div></div>
      ${isAdmin?`<div class="stat-card"><div class="stat-ic"><i class="fas fa-user-graduate"></i></div><div><div class="stat-val">${studentsCount}</div><div class="stat-lbl">الطلاب</div></div></div>`:''}
      <div class="stat-card"><div class="stat-ic"><i class="fas fa-video"></i></div><div><div class="stat-val">${lessonsCount}</div><div class="stat-lbl">المحاضرات</div></div></div>
      <div class="stat-card"><div class="stat-ic"><i class="fas fa-route"></i></div><div><div class="stat-val">${State.paths.length}</div><div class="stat-lbl">المسارات</div></div></div>
    </div>
    <div class="section">
      <div class="section-head"><h3>${State.user.role==='student'?'كورساتي':'أحدث الكورسات'}</h3><button class="btn btn-ghost btn-sm" id="goCourses">عرض الكل</button></div>
      <div class="course-grid" id="dashCourses"></div>
    </div>`;
  $('#goCourses').addEventListener('click', ()=>navigate('courses'));
  renderCourseGrid('#dashCourses', my);
}

/* ============== Views: Courses ============== */
function renderCoursesView(q='') {
  let list = catalogCourses();
  if (q) {
    const s = q.trim().toLowerCase();
    list = list.filter(c => (c.title+' '+c.category+' '+(c.description||'')).toLowerCase().includes(s));
  }
  $('#viewWrap').innerHTML = `
    <div class="page-head"><div><h1>الكورسات</h1><p>تصفّح كل الكورسات المتاحة على المنصة. الكورسات المقفلة تحتاج تسجيلاً من الإدارة لفتح محتواها.</p></div></div>
    <div class="course-grid" id="allCourses"></div>`;
  renderCourseGrid('#allCourses', list);
}

function renderCourseGrid(sel, list) {
  const el = $(sel); if (!el) return;
  if (!list.length) { el.outerHTML = `<div class="empty"><i class="fas fa-folder-open"></i><p>لا توجد كورسات.</p></div>`; return; }
  el.innerHTML = list.map(c => {
    const locked = State.user.role !== 'admin' && !isEnrolledInCourse(c);
    return `
    <div class="course-card ${locked?'is-locked':''}" data-id="${c.id}">
      <div class="course-thumb" style="background:${c.cover_image ? `url('${escapeHtml(c.cover_image)}') center/cover no-repeat` : c.color}">
        ${c.cover_image ? '' : `<i class="fas ${c.icon}"></i>`}
        <span class="badge-cat">${escapeHtml(c.category||'')}</span>
        ${locked ? `<span class="badge-lock" title="غير مسجَّل"><i class="fas fa-lock"></i></span>` : ''}
      </div>
      <div class="course-body">
        <h4>${escapeHtml(c.title)}</h4>
        <p>${escapeHtml(c.description||'')}</p>
        <div class="course-meta">
          <span><i class="fas fa-play-circle"></i> ${lessonsOf(c.id).length} محاضرة</span>
          <span><i class="fas fa-clock"></i> ${escapeHtml(c.duration||'—')}</span>
        </div>
      </div>
    </div>`;
  }).join('');
  el.addEventListener('click', e => {
    const card = e.target.closest('.course-card'); if (!card) return;
    if (card.classList.contains('is-locked')) {
      const c = list.find(x => x.id === card.dataset.id);
      openSubscribeModal(c ? c.title : '');
      return;
    }
    openCourse(card.dataset.id);
  });
}

/* ---- Accordion sections on the course detail page ---- */
function accordionSection({ key, icon, title, count, bodyHtml, openByDefault=false }) {
  return `
    <div class="section acc ${openByDefault?'open':''}" data-acc-key="${key}">
      <div class="section-head acc-head" data-acc-toggle="${key}">
        <h3><i class="fas ${icon}"></i> ${escapeHtml(title)} <span class="acc-count">(${count})</span></h3>
        <i class="fas fa-chevron-down acc-chevron"></i>
      </div>
      <div class="acc-body">${bodyHtml}</div>
    </div>`;
}
function initAccordions(root=document) {
  root.querySelectorAll('[data-acc-toggle]').forEach(head => {
    head.addEventListener('click', () => {
      head.closest('.acc').classList.toggle('open');
    });
  });
}

async function openCourse(id) {
  const c = State.courses.find(x=>x.id===id);
  if (!c) { toast('غير موجود','هذا الكورس غير موجود','warning'); return; }
  const enrolled = isEnrolledInCourse(c);
  const isAdmin = State.user.role === 'admin';

  // المحتوى الفعلي (المحاضرات/الاختبارات) يأتي من الخادم أساساً حسب صلاحيات RLS
  // الحقيقية؛ لو الطالب غير مسجَّل ستكون هذه المصفوفات فارغة تلقائياً من الباك-إند.
  const lessons = lessonsOf(id);
  const videos  = lessons.filter(l => l.type === 'video');
  const records = lessons.filter(l => l.type === 'record');
  const papers  = lessons.filter(l => l.type === 'pdf' || l.type === 'image' || l.type === 'file');
  const courseQuizzes = State.quizzes.filter(z=>z.course_id===id);

  const lessonRow = (l) => `
      <div class="lesson-item" data-lid="${l.id}">
        <div class="lesson-ic"><i class="fas ${l.type==='pdf'?'fa-file-pdf':l.type==='image'?'fa-image':l.type==='record'?'fa-clapperboard':l.type==='file'?'fa-paperclip':'fa-play'}"></i></div>
        <div class="lesson-info"><strong>${escapeHtml(l.title)}</strong><small>${escapeHtml(l.duration||'')}</small></div>
        <div class="lesson-act">
          <button class="btn btn-ghost btn-sm" data-open><i class="fas fa-${l.type==='pdf'?'eye':'play'}"></i> فتح</button>
          ${isAdmin?`<button class="icon-btn" data-del-lesson="${l.id}" style="color:var(--danger)"><i class="fas fa-trash"></i></button>`:''}
        </div>
      </div>`;
  const listOrEmpty = (arr, emptyMsg) => arr.length
    ? `<div class="lesson-list">${arr.map(lessonRow).join('')}</div>`
    : `<div class="empty"><i class="fas fa-circle-info"></i><p>${emptyMsg}</p></div>`;

  const lockedNotice = !enrolled && !isAdmin
    ? `<div class="locked-banner"><i class="fas fa-lock"></i>
        <div><strong>هذا الكورس غير متاح لك بعد.</strong>
        <p>تواصل مع إدارة المنصة لتسجيلك في هذا الكورس، وسيظهر لك محتواه فور تسجيلك.</p>
        <button type="button" class="btn btn-primary btn-sm" id="courseSubscribeBtn" style="margin-top:10px"><i class="fas fa-crown"></i> اشترك الآن</button></div>
      </div>`
    : '';

  const adminActions = isAdmin ? `<button class="btn btn-primary btn-sm" id="addLesson"><i class="fas fa-plus"></i> إضافة محتوى</button>` : '';

  const quizzesHtml = courseQuizzes.length ? `
    <div class="lesson-list">${courseQuizzes.map(z=>{
      const mine = State.myQuizAttempts.find(a=>a.quiz_id===z.id);
      const pct = mine && mine.max_score ? Math.round((mine.score/mine.max_score)*100) : null;
      const durationNote = `المدة: ${z.duration_minutes ?? 10} دقيقة`;
      const statusNote = mine ? `تم الأداء — النتيجة: ${mine.score}/${mine.max_score} (${pct}%)` : 'لم يتم الأداء بعد';
      return `<div class="lesson-item" data-quiz-item="${z.id}">
        <div class="lesson-ic"><i class="fas fa-file-circle-question"></i></div>
        <div class="lesson-info">
          <strong>${escapeHtml(z.title)}</strong>
          <small>${z.description ? escapeHtml(z.description)+' • ' : ''}${durationNote} • ${statusNote}</small>
        </div>
        <div class="lesson-act">
          ${isAdmin
            ? `<button class="btn btn-ghost btn-sm" data-manage-quiz="${z.id}"><i class="fas fa-gear"></i> إدارة</button>`
            : mine
              ? `<button class="btn btn-ghost btn-sm" data-view-result="${z.id}"><i class="fas fa-eye"></i> عرض النتيجة</button>`
              : `<button class="btn btn-primary btn-sm" data-take-quiz="${z.id}"><i class="fas fa-play"></i> بدء الاختبار</button>`}
        </div>
      </div>`;
    }).join('')}</div>` : `<div class="empty"><i class="fas fa-circle-info"></i><p>لا توجد اختبارات لهذا الكورس بعد.</p></div>`;

  mbGo('course', { id });
  $('#viewWrap').innerHTML = `
    <button class="btn btn-ghost btn-sm" id="back"><i class="fas fa-arrow-right"></i> رجوع</button>
    <div class="section" style="margin-top:16px">
      <div class="detail-head">
        <div class="detail-thumb" style="background:${c.color}"><i class="fas ${c.icon}"></i></div>
        <div class="detail-info">
          <h1>${escapeHtml(c.title)}</h1>
          <p>${escapeHtml(c.description||'')}</p>
          <div class="tags">
            <span class="tag"><i class="fas fa-folder"></i> ${escapeHtml(c.category||'')}</span>
            <span class="tag"><i class="fas fa-user"></i> ${escapeHtml(c.instructor||'—')}</span>
            <span class="tag"><i class="fas fa-clock"></i> ${escapeHtml(c.duration||'—')}</span>
          </div>
        </div>
      </div>
    </div>
    ${lockedNotice}
    ${isAdmin ? `<div style="margin-bottom:16px;display:flex;justify-content:flex-end">${adminActions}</div>` : ''}
    ${accordionSection({ key:'videos',  icon:'fa-play-circle',        title:'الفيديوهات',            count:videos.length,  bodyHtml:listOrEmpty(videos,'لا توجد فيديوهات بعد.'), openByDefault:true })}
    ${accordionSection({ key:'records', icon:'fa-clapperboard',       title:'الريكوردات',             count:records.length, bodyHtml:listOrEmpty(records,'لا توجد ريكوردات بعد.') })}
    ${accordionSection({ key:'papers',  icon:'fa-file-lines',         title:'ورق محاضرات الكورس',     count:papers.length,  bodyHtml:listOrEmpty(papers,'لا توجد ملفات/أوراق محاضرات بعد.') })}
    ${accordionSection({ key:'quizzes', icon:'fa-file-circle-question', title:'الاختبارات الإلكترونية', count:courseQuizzes.length, bodyHtml:quizzesHtml })}
  `;
  $('#back').addEventListener('click', ()=>navigate('courses'));
  if ($('#courseSubscribeBtn')) $('#courseSubscribeBtn').addEventListener('click', ()=>openSubscribeModal(c.title));
  initAccordions($('#viewWrap'));
  if ($('#addLesson')) $('#addLesson').addEventListener('click', ()=>openAddLessonModal(c.id));
  $$('.lesson-item[data-lid]').forEach(it => {
    it.addEventListener('click', (e) => {
      if (e.target.closest('[data-del-lesson]')) return;
      const l = lessons.find(x=>x.id===it.dataset.lid); if (l) playLesson(l);
    });
  });
  $$('[data-del-lesson]').forEach(b => b.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm('حذف هذا المحتوى؟')) return;
    const lid = b.dataset.delLesson;
    const lesson = lessons.find(x=>x.id===lid);
    if (lesson?.storage_path) {
      try { await sb.storage.from(LESSON_BUCKET).remove([lesson.storage_path]); } catch{}
      try { await sb.storage.from(BUCKET).remove([lesson.storage_path]); } catch{} // توافق مع ملفات قديمة رُفعت قبل هذا التحديث
    }
    await sb.from('lessons').delete().eq('id', lid);
    await loadCourses(); openCourse(id);
  }));
  $$('[data-take-quiz]').forEach(b=>b.addEventListener('click', (e)=>{ e.stopPropagation(); openQuizTake(b.dataset.takeQuiz, id); }));
  $$('[data-view-result]').forEach(b=>b.addEventListener('click', (e)=>{ e.stopPropagation(); openQuizResultView(b.dataset.viewResult, id); }));
  $$('[data-manage-quiz]').forEach(b=>b.addEventListener('click', (e)=>{ e.stopPropagation(); openManageQuizQuestions(b.dataset.manageQuiz); }));
}

// function playLesson(l) {
//   const url = l.url || '';
//   let body = `<div class="empty"><i class="fas fa-circle-info"></i><p>لا يوجد ملف.</p></div>`;
//   if (url) {
//     if (l.type==='video') body = `<div class="video-player"><video controls autoplay src="${url}" style="width:100%"></video></div>`;
//     else if (l.type==='pdf') body = `<div class="pdf-viewer"><iframe src="${url}" style="width:100%;height:70vh;border:0"></iframe></div>`;
//     else if (l.type==='image') body = `<div style="text-align:center"><img src="${url}" style="max-width:100%;border-radius:10px"/></div>`;
//     else body = `<div style="text-align:center;padding:20px"><a class="btn btn-primary" href="${url}" target="_blank" download><i class="fas fa-download"></i> تحميل الملف</a></div>`;
//   }
//   modal({ title: l.title, body, wide:true });
// }


async function resolveLessonUrl(l) {
  // ملف مرفوع فعلياً في الـ storage الخاص بالمحاضرات → لازم رابط موقّع (signed)
  // يُصدره الخادم بعد التحقق من صلاحية المستخدم (تسجيل حقيقي)، وليس رابطاً عاماً ثابتاً.
  if (l.storage_path) {
    try {
      const { data, error } = await sb.storage.from(LESSON_BUCKET).createSignedUrl(l.storage_path, 3600);
      if (error) throw error;
      if (data?.signedUrl) return data.signedUrl;
    } catch (e) {
      // توافق مع محتوى قديم رُفع قبل هذا التحديث إلى الـ bucket العام القديم
      try {
        const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(l.storage_path);
        if (pub?.publicUrl) return pub.publicUrl;
      } catch {}
      toast('تعذّر فتح الملف','ليست لديك صلاحية للوصول لهذا المحتوى','error');
      return '';
    }
  }
  // رابط خارجي أدخله الأدمن يدوياً (يوتيوب/فيميو...الخ)
  return l.url || '';
}

async function playLesson(l) {
  const url = await resolveLessonUrl(l);

  let body = `<div class="empty">
    <i class="fas fa-circle-info"></i>
    <p>لا يوجد ملف.</p>
  </div>`;

  if (url) {

    // تشغيل الفيديو (فيديو عادي أو ريكورد)
    if (l.type === 'video' || l.type === 'record') {


      // الجزء ده شغتا بس حولته لتعليق
      // body = `
      // <div class="video-player">
      //   <video
      //     controls
      //     playsinline
      //     preload="metadata"
      //     controlsList="nodownload"
      //     oncontextmenu="return false;"
      //     style="width:100%;border-radius:12px"
      //   >
      //     <source src="${url}" type="video/mp4">
      //     متصفحك لا يدعم تشغيل الفيديو
      //   </video>
      // </div>`;



      body = `
<div class="video-player">
  <video
    controls
    playsinline
    preload="metadata"
    controlsList="nodownload"
    oncontextmenu="return false;"
    style="width:100%;border-radius:12px"
  >
    <source src="${url}" type="video/mp4">
    متصفحك لا يدعم تشغيل الفيديو
  </video>
</div>`;

    }
    
    // PDF
    else if (l.type === 'pdf') {

      body = `
      <div class="pdf-viewer">
        <iframe
          src="${url}"
          style="width:100%;height:70vh;border:0">
        </iframe>
      </div>`;

    }

    // صورة
    else if (l.type === 'image') {

      body = `
      <div style="text-align:center">
        <img
          src="${url}"
          style="max-width:100%;border-radius:10px"/>
      </div>`;

    }

    // ملفات أخرى
    else {

      body = `
      <div style="text-align:center;padding:20px">
        <a class="btn btn-primary"
           href="${url}"
           target="_blank"
           download>
          <i class="fas fa-download"></i>
          تحميل الملف
        </a>
      </div>`;

    }
  }

  modal({
    title: l.title,
    body,
    wide: true
  });
}




/* ============== Student: taking a quiz (timed) ============== */
let quizTimerHandle = null;   // countdown setInterval
let quizAutosaveHandle = null; // autosave setInterval
let quizBeforeUnloadHandler = null;

function clearQuizTimers() {
  if (quizTimerHandle) { clearInterval(quizTimerHandle); quizTimerHandle = null; }
  if (quizAutosaveHandle) { clearInterval(quizAutosaveHandle); quizAutosaveHandle = null; }
  if (quizBeforeUnloadHandler) { window.removeEventListener('beforeunload', quizBeforeUnloadHandler); quizBeforeUnloadHandler = null; }
}

async function openQuizTake(quizId, courseId) {
  clearQuizTimers();
  const z = State.quizzes.find(x=>x.id===quizId); if (!z) return;
  if (State.myQuizAttempts.some(a=>a.quiz_id===quizId)) { toast('تم الأداء من قبل','','info'); return openQuizResultView(quizId, courseId); }

  // Server decides start time / deadline — never trust the browser clock.
  let session;
  try {
    const { data, error: rpcError } = await sb.rpc('start_quiz_attempt', { p_quiz_id: quizId });
    if (rpcError) throw rpcError;
    session = data;
  } catch(err) {
    console.error(err);
    toast('تعذّر بدء الاختبار', err.message || 'حدث خطأ', 'error');
    await loadMyQuizAttempts();
    if (State.myQuizAttempts.some(a=>a.quiz_id===quizId)) return openQuizResultView(quizId, courseId);
    return openCourse(courseId);
  }

  const { data: questions, error } = await sb.from('quiz_questions_public').select('*').eq('quiz_id', quizId).order('position').order('created_at');
  if (error) { toast('فشل تحميل الأسئلة', error.message, 'error'); return; }
  if (!questions.length) { toast('لا توجد أسئلة في هذا الاختبار بعد','','warning'); return; }

  // clock offset so the countdown tracks the SERVER's deadline, not the client's clock
  const clockOffsetMs = new Date(session.server_now).getTime() - Date.now();
  const deadlineMs = new Date(session.deadline).getTime();

  mbGo('quizTake', { quizId, courseId });
  $('#viewWrap').innerHTML = `
    <button class="btn btn-ghost btn-sm" id="back"><i class="fas fa-arrow-right"></i> رجوع للكورس</button>
    <div class="section" style="margin-top:16px">
      <div class="section-head">
        <h3>${escapeHtml(z.title)}</h3>
        <div class="tag" id="quizTimer" style="font-weight:700;font-size:15px"><i class="fas fa-clock"></i> <span id="quizTimerText">--:--</span></div>
      </div>
      ${z.description?`<p class="muted" style="margin-bottom:14px">${escapeHtml(z.description)}</p>`:''}
      <form id="quizForm" class="form">
        ${questions.map((q,i)=>`
          <div class="section" style="background:var(--surface-2);padding:16px;border-radius:var(--radius)">
            <strong>${i+1}. ${escapeHtml(q.question)}</strong>
            <div class="form" style="margin-top:10px;gap:8px">
              ${(q.options||[]).map(o=>`
                <label class="check" style="background:var(--surface);padding:10px 12px;border-radius:var(--radius-sm);border:1.5px solid var(--border)">
                  <input type="radio" name="q_${q.id}" value="${escapeHtml(o.id)}" required />
                  <span>${escapeHtml(o.text)}</span>
                </label>`).join('')}
            </div>
          </div>`).join('')}
        <button type="submit" class="btn btn-primary btn-block"><i class="fas fa-paper-plane"></i> إرسال الاختبار</button>
      </form>
    </div>`;

  const collectAnswers = () => {
    const answers = {};
    questions.forEach(q => { const sel = $(`input[name="q_${q.id}"]:checked`); if (sel) answers[q.id] = sel.value; });
    return answers;
  };

  let submitted = false;
  const doSubmit = async (auto=false) => {
    if (submitted) return;
    submitted = true;
    clearQuizTimers();
    const answers = collectAnswers();
    const form = $('#quizForm');
    const btn = form ? form.querySelector('button[type=submit]') : null;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ الإرسال...'; }
    if (form) $$('input', form).forEach(inp => inp.disabled = true);
    try {
      const { data, error: rpcError } = await sb.rpc('submit_quiz_attempt', { p_quiz_id: quizId, p_answers: answers });
      if (rpcError) throw rpcError;
      toast(auto ? 'انتهى الوقت' : 'تم التسليم', 'تم تصحيح الاختبار تلقائياً','success');
      await loadMyQuizAttempts();
      openQuizResultView(quizId, courseId, data);
    } catch(err) {
      console.error(err);
      toast('فشل الإرسال', err.message || 'حدث خطأ', 'error');
      submitted = false;
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال الاختبار'; }
      if (form) $$('input', form).forEach(inp => inp.disabled = false);
    }
  };

  const timerText = $('#quizTimerText');
  const timerChip = $('#quizTimer');
  const tick = () => {
    const remaining = deadlineMs - (Date.now() + clockOffsetMs);
    if (timerText) timerText.textContent = fmtCountdown(remaining);
    if (timerChip) timerChip.style.color = remaining <= 60000 ? 'var(--danger)' : '';
    if (remaining <= 0) { doSubmit(true); }
  };
  tick();
  quizTimerHandle = setInterval(tick, 1000);

  // best-effort autosave of in-progress answers, for crash recovery only
  quizAutosaveHandle = setInterval(() => {
    if (submitted) return;
    sb.rpc('save_quiz_progress', { p_quiz_id: quizId, p_answers: collectAnswers() }).catch(()=>{});
  }, 15000);

  quizBeforeUnloadHandler = (e) => { if (!submitted) { e.preventDefault(); e.returnValue=''; } };
  window.addEventListener('beforeunload', quizBeforeUnloadHandler);

  $('#back').addEventListener('click', ()=>{
    if (!submitted && !confirm('لم تقم بتسليم الاختبار بعد. الوقت سيستمر في العد أثناء غيابك، وسيتم التسليم تلقائياً عند انتهائه. هل تريد الخروج الآن؟')) return;
    clearQuizTimers();
    openCourse(courseId);
  });
  $('#quizForm').addEventListener('submit', (e)=>{ e.preventDefault(); doSubmit(false); });
}

async function openQuizResultView(quizId, courseId, freshResult) {
  clearQuizTimers();
  const z = State.quizzes.find(x=>x.id===quizId); if (!z) return;
  const attempt = State.myQuizAttempts.find(a=>a.quiz_id===quizId);
  if (!attempt && !freshResult) { toast('لا توجد نتيجة لهذا الاختبار','','warning'); return; }
  const score = freshResult?.score ?? attempt.score;
  const max = freshResult?.max_score ?? attempt.max_score;
  const breakdown = freshResult?.breakdown ?? attempt.breakdown ?? [];
  const status = freshResult?.status ?? attempt?.status ?? 'submitted';
  const pct = max ? Math.round((score/max)*100) : 0;
  const { data: questions } = await sb.from('quiz_questions_public').select('*').eq('quiz_id', quizId).order('position').order('created_at');
  const qList = questions || [];
  mbGo('quizResult', { quizId, courseId });
  $('#viewWrap').innerHTML = `
    <button class="btn btn-ghost btn-sm" id="back"><i class="fas fa-arrow-right"></i> رجوع للكورس</button>
    <div class="section" style="margin-top:16px;text-align:center">
      <div class="stat-ic" style="margin:0 auto 12px"><i class="fas fa-award"></i></div>
      <h1>${escapeHtml(z.title)}</h1>
      <p class="muted">نتيجتك: <strong style="color:var(--text)">${score} / ${max}</strong> (${pct}%)</p>
      ${status==='auto_submitted' ? `<p class="muted"><i class="fas fa-clock"></i> تم التسليم تلقائياً عند انتهاء الوقت</p>` : ''}
    </div>
    <div class="section">
      <div class="lesson-list">${qList.map((q,i)=>{
        const b = breakdown.find(x=>x.question_id===q.id);
        const ok = b?.correct;
        return `<div class="lesson-item">
          <div class="lesson-ic" style="color:${ok?'var(--success)':'var(--danger)'}"><i class="fas ${ok?'fa-circle-check':'fa-circle-xmark'}"></i></div>
          <div class="lesson-info"><strong>${i+1}. ${escapeHtml(q.question)}</strong><small>${ok?'إجابة صحيحة':'إجابة غير صحيحة'} • ${q.points} درجة</small></div>
        </div>`;
      }).join('')}</div>
    </div>`;
  $('#back').addEventListener('click', ()=>openCourse(courseId));
}

/* ============== Upload to Storage with progress ============== */
async function uploadFile(file, folder='uploads') {
  const safe = file.name.replace(/[^\w.\-]/g,'_');
  const path = `${folder}/${State.user.id}/${Date.now()}_${safe}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert:false, contentType: file.type });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path, name: file.name, type: file.type, size: file.size };
}

// رفع محتوى محاضرة (فيديو/ريكورد/ملف) إلى الـ bucket الخاص المحمي بصلاحيات RLS
// حقيقية — لا يُنتج رابطاً عاماً؛ يتم توليد رابط موقّت موقّع فقط لمن يملك صلاحية.
async function uploadLessonFile(file, courseId) {
  const safe = file.name.replace(/[^\w.\-]/g,'_');
  const path = `lessons/${courseId}/${Date.now()}_${safe}`;
  const { error } = await sb.storage.from(LESSON_BUCKET).upload(path, file, { upsert:false, contentType: file.type });
  if (error) throw error;
  return { path, name: file.name, type: file.type, size: file.size };
}

function openAddLessonModal(courseId) {
  const body = `<div class="form">
    <div class="field"><label>العنوان</label><input id="lTitle" placeholder="مثال: مقدمة في..." /></div>
    <div class="field"><label>النوع</label>
      <select id="lType">
        <option value="video">فيديو</option>
        <option value="record">ريكورد (تسجيل محاضرة)</option>
        <option value="pdf">ورق محاضرات (PDF)</option>
        <option value="image">صورة</option>
        <option value="file">ملف آخر</option>
      </select>
    </div>
    <div class="field"><label>المدة (اختياري)</label><input id="lDur" placeholder="15 د" /></div>
    <div class="field"><label>رفع الملف</label><input id="lFile" type="file" /></div>
    <div class="field"><label>أو رابط خارجي (مثال: يوتيوب)</label><input id="lUrl" placeholder="https://..." /></div>
    <div class="upload-progress" id="lProg" style="display:none"><div></div></div>
  </div>`;
  const footer = `<button class="btn btn-ghost" data-close>إلغاء</button><button class="btn btn-primary" id="saveLesson"><i class="fas fa-save"></i> حفظ</button>`;
  const m = modal({ title:'إضافة محتوى للكورس', body, footer });
  m.root.querySelector('[data-close]').addEventListener('click', m.close);
  m.root.querySelector('#saveLesson').addEventListener('click', async () => {
    const title = m.root.querySelector('#lTitle').value.trim();
    const type = m.root.querySelector('#lType').value;
    const dur = m.root.querySelector('#lDur').value.trim();
    const file = m.root.querySelector('#lFile').files[0];
    const urlIn = m.root.querySelector('#lUrl').value.trim();
    if (!title) return toast('عنوان مطلوب','','warning');
    let url = urlIn || null, storage_path = null;
    if (file) {
      const prog = m.root.querySelector('#lProg'); prog.style.display=''; prog.firstElementChild.style.width='30%';
      try { const r = await uploadLessonFile(file, courseId); storage_path = r.path; url = null; prog.firstElementChild.style.width='100%'; }
      catch(e){ console.error(e); return toast('فشل الرفع', e.message,'error'); }
    }
    const { error } = await sb.from('lessons').insert({ course_id: courseId, title, type, duration: dur||null, url, storage_path });
    if (error) return toast('فشل الحفظ', error.message,'error');
    await sb.from('notifications').insert({ user_id: null, title:'محتوى جديد', body:`أُضيف "${title}"`, icon:'fa-plus' });
    toast('تم الحفظ','','success'); m.close();
    await loadCourses(); openCourse(courseId);
  });
}

/* ============== Views: Paths ============== */
function renderPaths(){
  const list = catalogPaths();
  $('#viewWrap').innerHTML = `
    <div class="page-head"><div><h1>المسارات التعليمية</h1><p>تصفّح كل المسارات المتاحة على المنصة. المسارات المقفلة تحتاج تسجيلاً من الإدارة لفتح كورساتها.</p></div></div>
    <div class="course-grid" id="pathsGrid"></div>`;
  const g = $('#pathsGrid');
  if (!list.length) { g.outerHTML = `<div class="empty"><i class="fas fa-route"></i><p>لا توجد مسارات.</p></div>`; return; }
  g.innerHTML = list.map(p => {
    const courses = State.courses.filter(c=>c.path_id===p.id);
    const locked = State.user.role !== 'admin' && !isEnrolledInPath(p);
    return `<div class="path-card ${locked?'is-locked':''}" data-pid="${p.id}">
      <div class="path-thumb" style="background:${p.cover_image ? `url('${escapeHtml(p.cover_image)}') center/cover no-repeat` : p.color}">
        ${p.cover_image ? '' : `<i class="fas ${p.icon}"></i>`}
        ${locked ? `<span class="badge-lock" title="غير مسجَّل"><i class="fas fa-lock"></i></span>` : ''}
      </div>
      <h4>${escapeHtml(p.title)}</h4>
      <p class="muted">${escapeHtml(p.description||'')}</p>
      <div class="course-meta" style="margin-top:10px"><span><i class="fas fa-book"></i> ${courses.length} كورس</span></div>
    </div>`;
  }).join('');
  g.addEventListener('click', e => {
    const card = e.target.closest('.path-card'); if (!card) return;
    const p = State.paths.find(x=>x.id===card.dataset.pid);
    const locked = State.user.role !== 'admin' && !isEnrolledInPath(p);
    if (locked) { openSubscribeModal(p.title); return; }
    const courses = State.courses.filter(c=>c.path_id===p.id);
    modal({ title:p.title, wide:true, body:`
      <p>${escapeHtml(p.description||'')}</p>
      <div class="course-grid" id="pmCourses" style="margin-top:14px"></div>
    `});
    setTimeout(()=>renderCourseGrid('#pmCourses', courses),10);
  });
}

/* ============== Views: Manage Paths (Admin) ============== */
function renderManagePaths(){
  $('#viewWrap').innerHTML = `
    <div class="page-head">
      <div><h1>إدارة المسارات</h1><p>إنشاء وتعديل المسارات التعليمية.</p></div>
      <button class="btn btn-primary" id="addPath"><i class="fas fa-plus"></i> مسار جديد</button>
    </div>
    <div class="section"><div class="table-wrap"><table>
      <thead><tr><th>المسار</th><th>الوصف</th><th>الكورسات</th><th></th></tr></thead>
      <tbody>${State.paths.map(p=>`
        <tr><td><div style="display:flex;align-items:center;gap:10px"><div class="avatar" style="background:${p.color};width:34px;height:34px;color:#fff"><i class="fas ${p.icon}"></i></div>${escapeHtml(p.title)}</div></td>
        <td>${escapeHtml(p.description||'')}</td>
        <td>${State.courses.filter(c=>c.path_id===p.id).length}</td>
        <td><div class="row-actions">
          <button class="icon-btn" data-edit-path="${p.id}"><i class="fas fa-pen"></i></button>
          <button class="icon-btn" data-del-path="${p.id}" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
        </div></td></tr>`).join('')}</tbody>
    </table></div></div>`;
  $('#addPath').addEventListener('click', ()=>openPathModal());
  $$('[data-edit-path]').forEach(b=>b.addEventListener('click',()=>openPathModal(b.dataset.editPath)));
  $$('[data-del-path]').forEach(b=>b.addEventListener('click', async ()=>{
    if (!confirm('حذف هذا المسار؟')) return;
    await sb.from('learning_paths').delete().eq('id', b.dataset.delPath);
    await loadPaths(); renderManagePaths();
  }));
}

function openPathModal(id){
  const p = id ? State.paths.find(x=>x.id===id) : { title:'',description:'',icon:'fa-route',color:'linear-gradient(135deg,#4f46e5,#06b6d4)',cover_image:null};
  const body = `<div class="form">
    <div class="field"><label>العنوان</label><input id="pTitle" value="${escapeHtml(p.title)}"/></div>
    <div class="field"><label>الوصف</label><textarea id="pDesc" rows="3">${escapeHtml(p.description||'')}</textarea></div>
    <div class="field"><label>أيقونة</label><input id="pIcon" value="${escapeHtml(p.icon)}" placeholder="fa-route"/></div>
    <div class="field"><label>صورة الغلاف</label><input id="pCover" type="file" accept="image/*"/></div>
    ${p.cover_image ? `<div class="muted">الصورة الحالية محفوظة، ويمكن استبدالها برفع صورة جديدة.</div>` : ''}
  </div>`;
  const m = modal({ title: id?'تعديل مسار':'مسار جديد', body, footer:`<button class="btn btn-ghost" data-close>إلغاء</button><button class="btn btn-primary" id="savePath">حفظ</button>`});
  m.root.querySelector('[data-close]').addEventListener('click', m.close);
  m.root.querySelector('#savePath').addEventListener('click', async ()=>{
    const data = {
      title: m.root.querySelector('#pTitle').value.trim(),
      description: m.root.querySelector('#pDesc').value.trim(),
      icon: m.root.querySelector('#pIcon').value.trim() || 'fa-route',
      cover_image: p.cover_image || null,
    };
    if (!data.title) return toast('العنوان مطلوب','','warning');
    const file = m.root.querySelector('#pCover').files[0];
    if (file) {
      try { const r = await uploadFile(file, 'paths'); data.cover_image = r.url; }
      catch (e) { return toast('فشل رفع الصورة', e.message || 'تعذر رفع الصورة', 'error'); }
    }
    if (id) await sb.from('learning_paths').update(data).eq('id', id);
    else await sb.from('learning_paths').insert(data);
    await loadPaths(); m.close(); renderManagePaths(); toast('تم الحفظ','','success');
  });
}

/* ============== Views: Live Stream (per-course) ============== */
function liveCourseTitle(courseId) {
  const c = State.courses.find(x => x.id === courseId);
  return c ? c.title : 'كورس محذوف';
}

function livePlayerHtml(s) {
  const vid = 'liveV_' + s.id;
  if (s.kind === 'hls') return `<div class="live-player"><video id="${vid}" data-hls-url="${escapeHtml(safeUrl(s.url))}" controls autoplay playsinline></video></div>`;
  if (s.kind === 'youtube') {
    const idm = (s.url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/) || [])[1];
    const embedSrc = idm ? `https://www.youtube.com/embed/${encodeURIComponent(idm)}?autoplay=1` : safeUrl(s.url);
    return `<div class="live-player"><iframe src="${escapeHtml(embedSrc)}" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>`;
  }
  return `<div class="live-player"><iframe src="${escapeHtml(safeUrl(s.url))}" allow="autoplay; fullscreen"></iframe></div>`;
}

function initLivePlayers(root) {
  root.querySelectorAll('video[data-hls-url]').forEach(v => {
    const hlsUrl = v.dataset.hlsUrl;
    if (!hlsUrl) return;
    if (window.Hls && window.Hls.isSupported()) { const h = new Hls(); h.loadSource(hlsUrl); h.attachMedia(v); }
    else { v.src = hlsUrl; }
  });
}

function renderLive() {
  const isAdmin = State.user.role === 'admin';
  const streams = State.liveStreams || [];

  const adminCtl = isAdmin ? `<div class="section">
    <div class="section-head"><h3>تحكّم الأدمن</h3>
      <button class="btn btn-primary" id="startLive"><i class="fas fa-tower-broadcast"></i> بدء بث جديد</button>
    </div>
    <p class="muted">كل بث مباشر مرتبط بكورس محدد — يشاهده فقط الطلاب المسجَّلون في ذلك الكورس (مباشرة أو عبر مساره).</p>
  </div>` : '';

  const streamsHtml = streams.length
    ? streams.map(s => `
      <div class="section">
        <div class="section-head">
          <h3><i class="fas fa-tower-broadcast" style="color:var(--danger,#ef4444)"></i> ${escapeHtml(s.title)} <span class="acc-count">(${escapeHtml(liveCourseTitle(s.course_id))})</span></h3>
          ${isAdmin ? `<button class="btn btn-danger btn-sm" data-stop-live="${s.id}"><i class="fas fa-stop"></i> إيقاف</button>` : ''}
        </div>
        ${livePlayerHtml(s)}
      </div>`).join('')
    : `<div class="empty"><i class="fas fa-tower-broadcast"></i><p>${isAdmin ? 'لا يوجد بث مباشر نشط حالياً.' : 'لا يوجد بث مباشر حالياً لأي من كورساتك.'}</p></div>`;

  $('#viewWrap').innerHTML = `
    <div class="page-head"><div><h1>البث المباشر</h1><p>${streams.length ? 'البثوث المباشرة المتاحة لك الآن.' : 'انتظر بدء البث من قِبَل المدير لأحد كورساتك.'}</p></div></div>
    ${adminCtl}
    ${streamsHtml}`;

  initLivePlayers($('#viewWrap'));

  if (isAdmin) {
    if ($('#startLive')) $('#startLive').addEventListener('click', openStartLiveModal);
    $$('[data-stop-live]').forEach(b => b.addEventListener('click', async () => {
      await sb.from('live_streams').update({ active: false }).eq('id', b.dataset.stopLive);
      await loadActiveLive(); renderLive();
    }));
  }
}

async function notifyCourseLive(courseId, courseTitle) {
  try {
    const { data: enrolled } = await sb.from('enrollments').select('user_id').eq('course_id', courseId);
    const course = State.courses.find(c => c.id === courseId);
    let pathEnrolled = [];
    if (course && course.path_id) {
      const { data } = await sb.from('path_enrollments').select('user_id').eq('path_id', course.path_id);
      pathEnrolled = data || [];
    }
    const ids = [...new Set([...(enrolled || []), ...pathEnrolled].map(r => r.user_id))];
    if (!ids.length) return;
    await sb.from('notifications').insert(ids.map(uid => ({
      user_id: uid, title: 'بث مباشر الآن', body: courseTitle, icon: 'fa-tower-broadcast'
    })));
  } catch (e) { console.error('notifyCourseLive failed', e); }
}

function openStartLiveModal(){
  const courseOpts = State.courses.map(c => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('');
  const body = `<div class="form">
    <div class="field"><label>الكورس</label>
      <select id="lvCourse">${courseOpts || '<option value="">لا توجد كورسات</option>'}</select>
    </div>
    <div class="field"><label>عنوان البث</label><input id="lvTitle" placeholder="حصة اليوم"/></div>
    <div class="field"><label>نوع المصدر</label>
      <select id="lvKind">
        <option value="hls">HLS (m3u8)</option>
        <option value="youtube">يوتيوب</option>
        <option value="iframe">رابط iframe</option>
      </select>
    </div>
    <div class="field"><label>الرابط</label><input id="lvUrl" placeholder="https://..."/></div>
  </div>`;
  const m = modal({ title:'بدء بث مباشر', body, footer:`<button class="btn btn-ghost" data-close>إلغاء</button><button class="btn btn-primary" id="goLive">بث</button>`});
  m.root.querySelector('[data-close]').addEventListener('click', m.close);
  m.root.querySelector('#goLive').addEventListener('click', async ()=>{
    const courseId = m.root.querySelector('#lvCourse').value;
    const title = m.root.querySelector('#lvTitle').value.trim() || 'بث مباشر';
    const kind = m.root.querySelector('#lvKind').value;
    const url = m.root.querySelector('#lvUrl').value.trim();
    if (!courseId) return toast('اختر الكورس','البث يجب أن يكون مرتبطاً بكورس محدد','warning');
    if (!url) return toast('الرابط مطلوب','','warning');
    // إيقاف أي بث نشط سابق لنفس الكورس فقط (لا يؤثر على بثوث كورسات أخرى)
    await sb.from('live_streams').update({ active:false }).eq('active', true).eq('course_id', courseId);
    await sb.from('live_streams').insert({ title, kind, url, course_id: courseId, started_by: State.user.id, active:true });
    const course = State.courses.find(c => c.id === courseId);
    await notifyCourseLive(courseId, course ? course.title : title);
    m.close(); await loadActiveLive(); renderLive();
  });
}

/* ============== Views: Students (Admin) ============== */
function renderStudents() {
  const students = State.profiles.filter(p=>p.role==='student');
  $('#viewWrap').innerHTML = `
    <div class="page-head">
      <div><h1>الطلاب</h1><p>إضافة، حذف وإدارة وصول الطلاب للكورسات والمسارات.</p></div>
      <button class="btn btn-primary" id="addStu"><i class="fas fa-plus"></i> إضافة طالب</button>
    </div>
    <div class="section"><div class="table-wrap"><table>
      <thead><tr><th>الطالب</th><th>المستخدم</th><th>البريد</th><th>الحالة</th><th>كورسات</th><th>الانضمام</th><th></th></tr></thead>
      <tbody>${students.map(s=>`
        <tr>
          <td><div style="display:flex;align-items:center;gap:10px"><div class="avatar" style="width:34px;height:34px;font-size:13px">${escapeHtml(s.avatar||s.name[0])}<span class="online-dot ${s.online?'on':''}"></span></div>${escapeHtml(s.name)}</div></td>
          <td>${escapeHtml(s.username)}</td><td>${escapeHtml(s.email||'—')}</td>
          <td>${s.online?'<span style="color:var(--success)">●  متصل</span>':'<span class="muted">●  غير متصل</span>'}</td>
          <td>${State.enrollments.filter(e=>e.user_id===s.id).length}</td>
          <td>${fmtDate(s.joined_at)}</td>
          <td><div class="row-actions">
            <button class="icon-btn" data-access="${s.id}" title="إدارة الوصول"><i class="fas fa-key"></i></button>
            <button class="icon-btn" data-del-stu="${s.id}" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
          </div></td>
        </tr>`).join('')}</tbody>
    </table></div></div>`;
  $('#addStu').addEventListener('click', openStudentModal);
  $$('[data-access]').forEach(b=>b.addEventListener('click',()=>openAccessModal(b.dataset.access)));
  $$('[data-del-stu]').forEach(b=>b.addEventListener('click', async ()=>{
    if (!confirm('حذف الطالب؟ (يتم حذف الملف الشخصي فقط؛ حذف حساب Auth يتم من لوحة Supabase)')) return;
    await sb.from('profiles').delete().eq('id', b.dataset.delStu);
    await loadProfiles(); renderStudents();
  }));
}

function openStudentModal(){
  const body = `<div class="form">
    <div class="field"><label>الاسم</label><input id="sName"/></div>
    <div class="field"><label>اسم المستخدم</label><input id="sUser" placeholder="user1"/></div>
    <div class="field"><label>البريد (اختياري)</label><input id="sEmail" placeholder="user@example.com"/></div>
    <div class="field"><label>كلمة المرور (8 أحرف على الأقل)</label><input id="sPass" type="text" value="student1234"/></div>
  </div>`;
  const m = modal({ title:'طالب جديد', body, footer:`<button class="btn btn-ghost" data-close>إلغاء</button><button class="btn btn-primary" id="saveStu">إنشاء</button>`});
  m.root.querySelector('[data-close]').addEventListener('click', m.close);
  m.root.querySelector('#saveStu').addEventListener('click', async ()=>{
    const name = m.root.querySelector('#sName').value.trim();
    const username = m.root.querySelector('#sUser').value.trim().toLowerCase();
    const emailIn = m.root.querySelector('#sEmail').value.trim();
    const password = m.root.querySelector('#sPass').value;
    if (!name||!username||password.length<6) return toast('بيانات ناقصة','','warning');
    const email = emailIn || usernameToEmail(username);
    const { data: { session } } = await sb.auth.getSession();

if (!session) {
  return toast('انتهت الجلسة', 'سجّل دخولك كمدير مرة أخرى', 'error');
}

const response = await fetch(
  `${SUPABASE_URL}/functions/v1/admin-users`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': SUPABASE_KEY
    },
    body: JSON.stringify({
      action: 'create',
      role: 'student',
      email,
      password,
      name,
      username
    })
  }
);

const result = await response.json();

if (!response.ok) {
  return toast('فشل إنشاء الطالب', result.error || 'حدث خطأ غير معروف', 'error');
}
    if (error) return toast('فشل الإنشاء', error.message,'error');
    toast('تم إنشاء الطالب','','success'); m.close();
    setTimeout(async ()=>{ await loadProfiles(); renderStudents(); }, 800);
  });
}

function openAccessModal(uid){
  const u = State.profiles.find(p=>p.id===uid); if (!u) return;
  const enrolledCourses = new Set(State.enrollments.filter(e=>e.user_id===uid).map(e=>e.course_id));
  const enrolledPaths = new Set(State.pathEnrollments.filter(e=>e.user_id===uid).map(e=>e.path_id));
  const coursesHtml = State.courses.map(c=>`<label class="check"><input type="checkbox" data-course="${c.id}" ${enrolledCourses.has(c.id)?'checked':''}/> <span>${escapeHtml(c.title)}</span></label>`).join('');
  const pathsHtml = State.paths.map(p=>`<label class="check"><input type="checkbox" data-path="${p.id}" ${enrolledPaths.has(p.id)?'checked':''}/> <span>${escapeHtml(p.title)}</span></label>`).join('');
  const body = `<h4>الكورسات</h4><div class="form" style="max-height:200px;overflow:auto;border:1px solid var(--border);padding:10px;border-radius:10px">${coursesHtml||'<p class="muted">لا توجد كورسات</p>'}</div>
    <h4 style="margin-top:14px">المسارات</h4><div class="form" style="max-height:200px;overflow:auto;border:1px solid var(--border);padding:10px;border-radius:10px">${pathsHtml||'<p class="muted">لا توجد مسارات</p>'}</div>`;
  const m = modal({ title:`إدارة وصول: ${u.name}`, body, wide:true, footer:`<button class="btn btn-ghost" data-close>إلغاء</button><button class="btn btn-primary" id="saveAcc">حفظ</button>`});
  m.root.querySelector('[data-close]').addEventListener('click', m.close);
  m.root.querySelector('#saveAcc').addEventListener('click', async ()=>{
    const wantCourses = [...m.root.querySelectorAll('[data-course]:checked')].map(x=>x.dataset.course);
    const wantPaths = [...m.root.querySelectorAll('[data-path]:checked')].map(x=>x.dataset.path);
    await sb.from('enrollments').delete().eq('user_id', uid);
    if (wantCourses.length) await sb.from('enrollments').insert(wantCourses.map(cid=>({ user_id: uid, course_id: cid })));
    await sb.from('path_enrollments').delete().eq('user_id', uid);
    if (wantPaths.length) await sb.from('path_enrollments').insert(wantPaths.map(pid=>({ user_id: uid, path_id: pid })));
    await sb.from('notifications').insert({ user_id: uid, title:'تحديث وصولك', body:'تم تحديث الكورسات والمسارات المتاحة لك', icon:'fa-key' });
    await loadEnrollments(); m.close(); toast('تم الحفظ','','success');
  });
}

/* ============== Views: Manage Courses (Admin) ============== */
function renderManageCourses() {
  $('#viewWrap').innerHTML = `
    <div class="page-head">
      <div><h1>إدارة الكورسات</h1><p>إضافة وتعديل وحذف الكورسات.</p></div>
      <button class="btn btn-primary" id="addC"><i class="fas fa-plus"></i> كورس جديد</button>
    </div>
    <div class="section"><div class="table-wrap"><table>
      <thead><tr><th>الكورس</th><th>القسم</th><th>المسار</th><th>المدرّس</th><th>محاضرات</th><th></th></tr></thead>
      <tbody>${State.courses.map(c=>{
        const p = State.paths.find(x=>x.id===c.path_id);
        return `<tr>
          <td><div style="display:flex;align-items:center;gap:10px"><div class="avatar" style="background:${c.color};width:34px;height:34px;color:#fff"><i class="fas ${c.icon}"></i></div>${escapeHtml(c.title)}</div></td>
          <td><span class="tag">${escapeHtml(c.category||'')}</span></td>
          <td>${p?escapeHtml(p.title):'—'}</td>
          <td>${escapeHtml(c.instructor||'—')}</td>
          <td>${lessonsOf(c.id).length}</td>
          <td><div class="row-actions">
            <button class="icon-btn" data-open-c="${c.id}"><i class="fas fa-eye"></i></button>
            <button class="icon-btn" data-edit-c="${c.id}"><i class="fas fa-pen"></i></button>
            <button class="icon-btn" data-del-c="${c.id}" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
          </div></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div></div>`;
  $('#addC').addEventListener('click',()=>openCourseModal());
  $$('[data-open-c]').forEach(b=>b.addEventListener('click',()=>openCourse(b.dataset.openC)));
  $$('[data-edit-c]').forEach(b=>b.addEventListener('click',()=>openCourseModal(b.dataset.editC)));
  $$('[data-del-c]').forEach(b=>b.addEventListener('click', async ()=>{
    if (!confirm('حذف الكورس وكل محاضراته؟')) return;
    await sb.from('courses').delete().eq('id', b.dataset.delC);
    await loadCourses(); renderManageCourses();
  }));
}

function openCourseModal(id){
  const c = id ? State.courses.find(x=>x.id===id) : { title:'',category:'',description:'',instructor:'',instructor_image:null,cover_image:null,duration:'',icon:'fa-book',color:'linear-gradient(135deg,#4f46e5,#06b6d4)',path_id:null };
  const pathOpts = `<option value="">— بدون مسار —</option>` + State.paths.map(p=>`<option value="${p.id}" ${c.path_id===p.id?'selected':''}>${escapeHtml(p.title)}</option>`).join('');
  const body = `<div class="form">
    <div class="field"><label>العنوان</label><input id="cTitle" value="${escapeHtml(c.title)}"/></div>
    <div class="field"><label>القسم</label><input id="cCat" value="${escapeHtml(c.category||'')}"/></div>
    <div class="field"><label>الوصف</label><textarea id="cDesc" rows="3">${escapeHtml(c.description||'')}</textarea></div>
    <div class="field"><label>المدرّس</label><input id="cIns" value="${escapeHtml(c.instructor||'')}"/></div>
    <div class="field"><label>صورة المدرّس</label><input id="cInsImg" type="file" accept="image/*"/></div>
    <div class="field"><label>صورة غلاف الكورس</label><input id="cCover" type="file" accept="image/*"/></div>
    <div class="field"><label>المدة</label><input id="cDur" value="${escapeHtml(c.duration||'')}"/></div>
    <div class="field"><label>الأيقونة</label><input id="cIcon" value="${escapeHtml(c.icon)}"/></div>
    <div class="field"><label>المسار التعليمي</label><select id="cPath">${pathOpts}</select></div>
  </div>`;
  const m = modal({ title: id?'تعديل كورس':'كورس جديد', body, footer:`<button class="btn btn-ghost" data-close>إلغاء</button><button class="btn btn-primary" id="saveC">حفظ</button>`});
  m.root.querySelector('[data-close]').addEventListener('click', m.close);
  m.root.querySelector('#saveC').addEventListener('click', async ()=>{
    const data = {
      title: m.root.querySelector('#cTitle').value.trim(),
      category: m.root.querySelector('#cCat').value.trim()||'عام',
      description: m.root.querySelector('#cDesc').value.trim(),
      instructor: m.root.querySelector('#cIns').value.trim(),
      instructor_image: c.instructor_image || null,
      cover_image: c.cover_image || null,
      duration: m.root.querySelector('#cDur').value.trim(),
      icon: m.root.querySelector('#cIcon').value.trim()||'fa-book',
      path_id: m.root.querySelector('#cPath').value || null,
    };
    if (!data.title) return toast('العنوان مطلوب','','warning');
    const cover = m.root.querySelector('#cCover').files[0];
    const insImg = m.root.querySelector('#cInsImg').files[0];
    try {
      if (cover) data.cover_image = (await uploadFile(cover, 'courses')).url;
      if (insImg) data.instructor_image = (await uploadFile(insImg, 'instructors')).url;
    } catch (e) { return toast('فشل رفع الصورة', e.message || 'تعذر رفع الصورة', 'error'); }
    if (id) await sb.from('courses').update(data).eq('id', id);
    else await sb.from('courses').insert(data);
    await loadCourses(); m.close(); renderManageCourses(); toast('تم الحفظ','','success');
  });
}

/* ============== Views: Quizzes (admin) ============== */
function renderManageQuizzes() {
  $('#viewWrap').innerHTML = `
    <div class="page-head">
      <div><h1>إدارة الاختبارات</h1><p>إنشاء وتعديل اختبارات الكورسات وأسئلتها.</p></div>
      <button class="btn btn-primary" id="addQ"><i class="fas fa-plus"></i> اختبار جديد</button>
    </div>
    <div class="section"><div class="table-wrap"><table>
      <thead><tr><th>الاختبار</th><th>الكورس</th><th>المدة</th><th>الأسئلة</th><th></th></tr></thead>
      <tbody>${State.quizzes.length ? State.quizzes.map(z=>{
        const c = State.courses.find(x=>x.id===z.course_id);
        return `<tr>
          <td><strong>${escapeHtml(z.title)}</strong>${z.description?`<div class="muted">${escapeHtml(z.description)}</div>`:''}</td>
          <td>${c?escapeHtml(c.title):'<span class="muted">— كورس محذوف —</span>'}</td>
          <td>${z.duration_minutes ?? '—'} د</td>
          <td id="qcount-${z.id}">…</td>
          <td><div class="row-actions">
            <button class="icon-btn" data-questions-z="${z.id}" title="الأسئلة"><i class="fas fa-list-check"></i></button>
            <button class="icon-btn" data-results-z="${z.id}" title="النتائج"><i class="fas fa-chart-simple"></i></button>
            <button class="icon-btn" data-edit-z="${z.id}" title="تعديل"><i class="fas fa-pen"></i></button>
            <button class="icon-btn" data-del-z="${z.id}" title="حذف" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
          </div></td>
        </tr>`;
      }).join('') : `<tr><td colspan="5"><div class="empty"><i class="fas fa-file-circle-question"></i><p>لا توجد اختبارات بعد.</p></div></td></tr>`}</tbody>
    </table></div></div>`;
  $('#addQ').addEventListener('click', ()=>openQuizModal());
  $$('[data-questions-z]').forEach(b=>b.addEventListener('click', ()=>openManageQuizQuestions(b.dataset.questionsZ)));
  $$('[data-results-z]').forEach(b=>b.addEventListener('click', ()=>openQuizResults(b.dataset.resultsZ)));
  $$('[data-edit-z]').forEach(b=>b.addEventListener('click', ()=>openQuizModal(b.dataset.editZ)));
  $$('[data-del-z]').forEach(b=>b.addEventListener('click', async ()=>{
    if (!confirm('حذف الاختبار وكل أسئلته ونتائجه؟')) return;
    const { error } = await sb.from('quizzes').delete().eq('id', b.dataset.delZ);
    if (error) return toast('فشل الحذف', error.message, 'error');
    await loadQuizzes(); renderManageQuizzes(); toast('تم الحذف','','success');
  }));
  // fill question counts async without blocking the table render
  State.quizzes.forEach(async z => {
    const { count } = await sb.from('quiz_questions').select('id',{count:'exact', head:true}).eq('quiz_id', z.id);
    const cell = $(`#qcount-${z.id}`); if (cell) cell.textContent = count ?? 0;
  });
}

function openQuizModal(id) {
  const z = id ? State.quizzes.find(x=>x.id===id) : { title:'', description:'', course_id: State.courses[0]?.id || '', duration_minutes: 10 };
  if (!State.courses.length) { toast('لا توجد كورسات','أضف كورساً أولاً قبل إنشاء اختبار','warning'); return; }
  const courseOpts = State.courses.map(c=>`<option value="${c.id}" ${z.course_id===c.id?'selected':''}>${escapeHtml(c.title)}</option>`).join('');
  const body = `<div class="form">
    <div class="field"><label>اسم الاختبار</label><input id="zTitle" value="${escapeHtml(z.title)}" placeholder="مثال: اختبار الوحدة الأولى"/></div>
    <div class="field"><label>وصف الاختبار (اختياري)</label><textarea id="zDesc" rows="3">${escapeHtml(z.description||'')}</textarea></div>
    <div class="field"><label>الكورس</label><select id="zCourse">${courseOpts}</select></div>
    <div class="field"><label>مدة الاختبار (بالدقائق)</label><input id="zDuration" type="number" min="1" step="1" value="${z.duration_minutes ?? 10}" placeholder="مثال: 15"/></div>
  </div>`;
  const m = modal({ title: id?'تعديل اختبار':'اختبار جديد', body, footer:`<button class="btn btn-ghost" data-close>إلغاء</button><button class="btn btn-primary" id="saveZ">حفظ</button>`});
  m.root.querySelector('[data-close]').addEventListener('click', m.close);
  m.root.querySelector('#saveZ').addEventListener('click', async ()=>{
    const duration = parseInt(m.root.querySelector('#zDuration').value, 10);
    const data = {
      title: m.root.querySelector('#zTitle').value.trim(),
      description: m.root.querySelector('#zDesc').value.trim() || null,
      course_id: m.root.querySelector('#zCourse').value,
      duration_minutes: duration,
    };
    if (!data.title) return toast('اسم الاختبار مطلوب','','warning');
    if (!data.course_id) return toast('اختر الكورس','','warning');
    if (!duration || duration < 1) return toast('حدد مدة صحيحة للاختبار بالدقائق','','warning');
    let error;
    if (id) ({ error } = await sb.from('quizzes').update(data).eq('id', id));
    else ({ error } = await sb.from('quizzes').insert({ ...data, created_by: State.user.id }));
    if (error) return toast('فشل الحفظ', error.message, 'error');
    await loadQuizzes(); m.close(); renderManageQuizzes(); toast('تم الحفظ','','success');
  });
}

/* ---- Admin: manage a single quiz's questions ---- */
async function openManageQuizQuestions(quizId) {
  const z = State.quizzes.find(x=>x.id===quizId); if (!z) return;
  const { data: questions, error } = await sb.from('quiz_questions').select('*').eq('quiz_id', quizId).order('position').order('created_at');
  if (error) { toast('فشل تحميل الأسئلة', error.message, 'error'); return; }
  const listHtml = questions.length ? questions.map((q,i)=>{
    const opts = Array.isArray(q.options) ? q.options : [];
    return `<div class="lesson-item" data-qid="${q.id}">
      <div class="lesson-ic"><i class="fas fa-circle-question"></i></div>
      <div class="lesson-info">
        <strong>${i+1}. ${escapeHtml(q.question)}</strong>
        <small>${opts.length} خيارات • ${q.points} درجة • الصحيحة: ${escapeHtml((opts.find(o=>o.id===q.correct_option)||{}).text || q.correct_option)}</small>
      </div>
      <div class="lesson-act">
        <button class="btn btn-ghost btn-sm" data-edit-q="${q.id}"><i class="fas fa-pen"></i> تعديل</button>
        <button class="icon-btn" data-del-q="${q.id}" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('') : `<div class="empty"><i class="fas fa-circle-info"></i><p>لا توجد أسئلة بعد.</p></div>`;
  mbGo('manageQuizQuestions', { quizId });
  $('#viewWrap').innerHTML = `
    <button class="btn btn-ghost btn-sm" id="back"><i class="fas fa-arrow-right"></i> رجوع للاختبارات</button>
    <div class="section" style="margin-top:16px">
      <div class="section-head"><h3>${escapeHtml(z.title)}</h3><button class="btn btn-primary btn-sm" id="addQuestion"><i class="fas fa-plus"></i> سؤال جديد</button></div>
      ${z.description?`<p class="muted" style="margin-bottom:14px">${escapeHtml(z.description)}</p>`:''}
      <div class="lesson-list">${listHtml}</div>
    </div>`;
  $('#back').addEventListener('click', ()=>navigate('manageQuizzes'));
  $('#addQuestion').addEventListener('click', ()=>openQuestionModal(quizId, null, ()=>openManageQuizQuestions(quizId)));
  $$('[data-edit-q]').forEach(b=>b.addEventListener('click', ()=>openQuestionModal(quizId, b.dataset.editQ, ()=>openManageQuizQuestions(quizId))));
  $$('[data-del-q]').forEach(b=>b.addEventListener('click', async ()=>{
    if (!confirm('حذف هذا السؤال؟')) return;
    const { error } = await sb.from('quiz_questions').delete().eq('id', b.dataset.delQ);
    if (error) return toast('فشل الحذف', error.message, 'error');
    openManageQuizQuestions(quizId);
  }));
}

function openQuestionModal(quizId, questionId, onSaved) {
  const existing = questionId ? null : null; // filled below after async fetch if editing
  const buildBody = (q) => {
    const opts = (q && Array.isArray(q.options) && q.options.length) ? q.options : [{id:'a',text:''},{id:'b',text:''}];
    return `<div class="form">
      <div class="field"><label>نص السؤال</label><textarea id="qText" rows="2">${escapeHtml(q?.question||'')}</textarea></div>
      <div class="field"><label>الخيارات (اختيار من متعدد)</label>
        <div id="optsWrap" class="form" style="gap:8px">
          ${opts.map(o=>`<div class="input-icon" data-opt-row="${o.id}" style="display:flex;align-items:center;gap:8px">
            <input type="text" class="opt-text" value="${escapeHtml(o.text)}" placeholder="نص الخيار" style="padding:10px 12px"/>
            <button type="button" class="icon-btn remove-opt" title="حذف الخيار"><i class="fas fa-xmark"></i></button>
          </div>`).join('')}
        </div>
        <button type="button" class="btn btn-ghost btn-sm" id="addOpt" style="margin-top:8px"><i class="fas fa-plus"></i> إضافة خيار</button>
      </div>
      <div class="field"><label>الإجابة الصحيحة</label><select id="qCorrect"></select></div>
      <div class="field"><label>الدرجة</label><input id="qPoints" type="number" min="1" value="${q?.points||1}"/></div>
    </div>`;
  };
  const renderCorrectOptions = (root) => {
    const rows = [...root.querySelectorAll('[data-opt-row]')];
    const sel = root.querySelector('#qCorrect');
    const current = sel.value;
    sel.innerHTML = rows.map((r,i)=>{
      const val = String.fromCharCode(97+i); // a, b, c...
      const text = r.querySelector('.opt-text').value || `خيار ${i+1}`;
      return `<option value="${val}">${escapeHtml(text)}</option>`;
    }).join('');
    if ([...sel.options].some(o=>o.value===current)) sel.value = current;
  };
  const wireOptsWrap = (root) => {
    root.querySelectorAll('.remove-opt').forEach(b=>b.addEventListener('click', ()=>{
      if (root.querySelectorAll('[data-opt-row]').length <= 2) return toast('يجب توفر خيارين على الأقل','','warning');
      b.closest('[data-opt-row]').remove();
      renderCorrectOptions(root);
    }));
    root.querySelectorAll('.opt-text').forEach(inp=>inp.addEventListener('input', ()=>renderCorrectOptions(root)));
  };

  const openWith = (q) => {
    const body = buildBody(q);
    const m = modal({ title: questionId?'تعديل سؤال':'سؤال جديد', body, footer:`<button class="btn btn-ghost" data-close>إلغاء</button><button class="btn btn-primary" id="saveQuestion">حفظ</button>`, wide:true });
    m.root.querySelector('[data-close]').addEventListener('click', m.close);
    wireOptsWrap(m.root);
    renderCorrectOptions(m.root);
    if (q?.correct_option) {
      const opts = Array.isArray(q.options)?q.options:[];
      const idx = opts.findIndex(o=>o.id===q.correct_option);
      if (idx>-1) m.root.querySelector('#qCorrect').value = String.fromCharCode(97+idx);
    }
    m.root.querySelector('#addOpt').addEventListener('click', ()=>{
      const wrap = m.root.querySelector('#optsWrap');
      const n = wrap.querySelectorAll('[data-opt-row]').length;
      const id = String.fromCharCode(97+n);
      const row = document.createElement('div');
      row.className = 'input-icon'; row.dataset.optRow = id;
      row.style.cssText = 'display:flex;align-items:center;gap:8px';
      row.innerHTML = `<input type="text" class="opt-text" placeholder="نص الخيار" style="padding:10px 12px"/><button type="button" class="icon-btn remove-opt" title="حذف الخيار"><i class="fas fa-xmark"></i></button>`;
      wrap.appendChild(row);
      wireOptsWrap(m.root);
      renderCorrectOptions(m.root);
    });
    m.root.querySelector('#saveQuestion').addEventListener('click', async ()=>{
      const text = m.root.querySelector('#qText').value.trim();
      const rows = [...m.root.querySelectorAll('[data-opt-row]')];
      const options = rows.map((r,i)=>({ id: String.fromCharCode(97+i), text: r.querySelector('.opt-text').value.trim() }));
      const correct = m.root.querySelector('#qCorrect').value;
      const points = parseInt(m.root.querySelector('#qPoints').value,10) || 1;
      if (!text) return toast('نص السؤال مطلوب','','warning');
      if (options.some(o=>!o.text)) return toast('أكمل نص كل الخيارات','','warning');
      if (!correct) return toast('حدد الإجابة الصحيحة','','warning');
      const data = { quiz_id: quizId, question: text, options, correct_option: correct, points };
      let error;
      if (questionId) ({ error } = await sb.from('quiz_questions').update(data).eq('id', questionId));
      else ({ error } = await sb.from('quiz_questions').insert(data));
      if (error) return toast('فشل الحفظ', error.message, 'error');
      toast('تم الحفظ','','success'); m.close(); onSaved && onSaved();
    });
  };

  if (!questionId) return openWith(null);
  sb.from('quiz_questions').select('*').eq('id', questionId).maybeSingle().then(({data,error})=>{
    if (error) { toast('فشل تحميل السؤال', error.message, 'error'); return; }
    openWith(data);
  });
}

/* ---- Admin: view results of a quiz ---- */
const attemptStatusLabel = s => s==='auto_submitted' ? 'تسليم تلقائي (انتهى الوقت)' : 'تم التسليم';

async function openQuizResults(quizId) {
  const z = State.quizzes.find(x=>x.id===quizId); if (!z) return;
  const { data: attempts, error } = await sb.from('quiz_attempts').select('*').eq('quiz_id', quizId).order('submitted_at',{ascending:false});
  if (error) { toast('فشل تحميل النتائج', error.message, 'error'); return; }
  const rows = attempts.length ? attempts.map(a=>{
    const p = profileOf(a.user_id);
    const pct = a.max_score ? Math.round((a.score/a.max_score)*100) : 0;
    return `<tr>
      <td>${escapeHtml(p?.name || 'طالب محذوف')}</td>
      <td>${a.score} / ${a.max_score}</td>
      <td>${pct}%</td>
      <td>${fmtDateTime(a.submitted_at)}</td>
      <td>${attemptStatusLabel(a.status)}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="5"><div class="empty"><i class="fas fa-inbox"></i><p>لا توجد نتائج بعد.</p></div></td></tr>`;
  mbGo('quizResults', { quizId });
  $('#viewWrap').innerHTML = `
    <button class="btn btn-ghost btn-sm" id="back"><i class="fas fa-arrow-right"></i> رجوع للاختبارات</button>
    <div class="section" style="margin-top:16px">
      <div class="section-head">
        <h3>نتائج: ${escapeHtml(z.title)}</h3>
        <button class="btn btn-ghost btn-sm" id="printResults"><i class="fas fa-print"></i> طباعة النتائج / PDF</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>الطالب</th><th>الدرجة</th><th>النسبة</th><th>تاريخ ووقت التسليم</th><th>حالة المحاولة</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  $('#back').addEventListener('click', ()=>navigate('manageQuizzes'));
  $('#printResults').addEventListener('click', ()=> printQuizResults(z, attempts||[]));
}

/* ---- Admin: print / save-as-PDF report for one quiz's results ---- */
function printQuizResults(quiz, attempts) {
  const rows = attempts.length ? attempts.map(a=>{
    const p = profileOf(a.user_id);
    const pct = a.max_score ? Math.round((a.score/a.max_score)*100) : 0;
    return `<tr>
      <td>${escapeHtml(p?.name || 'طالب محذوف')}</td>
      <td>${escapeHtml(quiz.title)}</td>
      <td>${a.score} / ${a.max_score}</td>
      <td>${pct}%</td>
      <td>${fmtDateTime(a.submitted_at)}</td>
      <td>${attemptStatusLabel(a.status)}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="6" style="text-align:center">لا توجد نتائج بعد</td></tr>`;
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>تقرير نتائج: ${escapeHtml(quiz.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; padding: 28px; color:#1a2238; }
  .head { display:flex; align-items:center; justify-content:space-between; border-bottom: 2px solid #4f46e5; padding-bottom:12px; margin-bottom:18px; }
  .head h1 { font-size:20px; margin:0; color:#4f46e5; }
  .head .brand { font-weight:800; font-size:16px; color:#4f46e5; }
  .meta { color:#555; font-size:13px; margin-bottom:18px; display:flex; gap:18px; flex-wrap:wrap; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { border:1px solid #ccc; padding:8px 10px; text-align:right; }
  th { background:#eef0ff; color:#3730a3; }
  tbody tr:nth-child(even) { background:#f9fafc; }
  .footer { margin-top:22px; font-size:11px; color:#888; text-align:center; }
  @media print { body{ padding:0; } }
</style>
</head>
<body>
  <div class="head">
    <div class="brand"><i></i>مَقْلَمَة</div>
    <h1>تقرير نتائج الاختبار</h1>
  </div>
  <div class="meta">
    <span><strong>اسم الاختبار:</strong> ${escapeHtml(quiz.title)}</span>
    <span><strong>عدد الطلاب:</strong> ${attempts.length}</span>
    <span><strong>تاريخ إصدار التقرير:</strong> ${fmtDateTime(new Date().toISOString())}</span>
  </div>
  <table>
    <thead>
      <tr><th>اسم الطالب</th><th>اسم الاختبار</th><th>الدرجة</th><th>النسبة المئوية</th><th>تاريخ ووقت الامتحان</th><th>حالة المحاولة</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">تم إنشاء هذا التقرير آلياً من منصة مَقْلَمَة التعليمية</div>
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;
  const w = window.open('', '_blank');
  if (!w) { toast('يرجى السماح بالنوافذ المنبثقة لطباعة التقرير','','warning'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

/* ============== Views: Profile ============== */
function renderProfile() {
  const u = State.user;
  const enrolled = visibleCourses();
  $('#viewWrap').innerHTML = `
    <div class="page-head"><div><h1>الملف الشخصي</h1><p>بياناتك على المنصة.</p></div></div>
    <div class="section">
      <div class="profile-card">
        <div class="profile-avatar">${escapeHtml(u.avatar||u.name[0])}</div>
        <div class="profile-info">
          <h2>${escapeHtml(u.name)}</h2>
          <p>${u.role==='admin'?'مدير المنصة':'طالب'} • ${escapeHtml(u.email||'')}</p>
          <div class="tags" style="margin-top:8px">
            <span class="tag"><i class="fas fa-calendar"></i> ${fmtDate(u.joined_at)}</span>
            <span class="tag"><i class="fas fa-graduation-cap"></i> ${enrolled.length} كورس</span>
          </div>
        </div>
      </div>
      <div class="kv-grid">
        <div class="kv"><small>الاسم</small><strong>${escapeHtml(u.name)}</strong></div>
        <div class="kv"><small>المستخدم</small><strong>${escapeHtml(u.username)}</strong></div>
        <div class="kv"><small>الدور</small><strong>${u.role==='admin'?'مدير':'طالب'}</strong></div>
        <div class="kv"><small>الكورسات المتاحة</small><strong>${enrolled.length}</strong></div>
      </div>
    </div>
    ${u.role==='student'?`<div class="section"><div class="section-head"><h3>كورساتي</h3></div><div class="course-grid" id="myCourses"></div></div>`:''}`;
  if (u.role==='student') renderCourseGrid('#myCourses', enrolled);
}

/* ============== Views: Settings ============== */
function renderSettings() {
  $('#viewWrap').innerHTML = `
    <div class="page-head"><div><h1>الإعدادات</h1><p>خصّص تجربتك.</p></div></div>
    <div class="section"><h3 style="margin-bottom:16px">المظهر</h3>
      <div class="form">
        <div class="field"><label>الوضع</label>
          <select id="setTheme">
            <option value="light" ${State.settings.theme==='light'?'selected':''}>فاتح</option>
            <option value="dark"  ${State.settings.theme==='dark' ?'selected':''}>ليلي</option>
          </select>
        </div>
      </div>
    </div>
    <div class="section">
      <h3 style="margin-bottom:10px">معلومات الاتصال</h3>
      <p class="muted">Supabase: ${sb?'<span style="color:var(--success)">متصل ✓</span>':'<span style="color:var(--danger)">غير مفعّل</span>'}</p>
    </div>`;
  $('#setTheme').addEventListener('change', e => {
    State.settings.theme = e.target.value;
    localStorage.setItem('maqlama_theme', State.settings.theme);
    applyTheme();
  });
}

/* ============== Notifications UI ============== */
function renderNotifications() {
  const list = State.notifications || [];
  const unread = list.filter(n => !n.read).length;

  const badge = $('#notifBadge');
  if (badge) {
    badge.textContent = unread;
    badge.style.display = unread ? 'grid' : 'none';
  }

  const wrap = $('#notifList');
  if (!wrap) return;

  if (!list.length) {
    wrap.innerHTML = `<div class="notif-empty">لا توجد إشعارات</div>`;
    return;
  }

  wrap.innerHTML = list.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" data-nid="${n.id}">
      <div class="ic">
        <i class="fas ${n.icon || 'fa-bell'}"></i>
      </div>

      <div class="meta">
        <strong>${escapeHtml(n.title)}</strong>
        <p>${escapeHtml(n.body || '')}</p>
        <small>${fmtTime(n.created_at)}</small>
      </div>

      <button
        type="button"
        class="notif-delete"
        data-delete-notification="${n.id}">
        حذف
      </button>
    </div>
  `).join('');

  // الضغط على الإشعار = تحديده كمقروء
  $$('.notif-item').forEach(it => {
    it.addEventListener('click', async (e) => {

      // لو الضغط كان على زر حذف، لا نعتبر الإشعار مقروءًا
      if (e.target.closest('.notif-delete')) return;

      const id = it.dataset.nid;

      await sb
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

      const notification = State.notifications.find(n => n.id === id);
      if (notification) notification.read = true;

      renderNotifications();
    });
  });

  // حذف إشعار واحد
  $$('.notif-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();

      const notificationId = btn.dataset.deleteNotification;

      const { error } = await sb
        .from('notification_dismissals')
        .upsert(
          {
            user_id: State.user.id,
            notification_id: notificationId
          },
          {
            onConflict: 'user_id,notification_id',
            ignoreDuplicates: true
          }
        );

      if (error) {
        console.error('Delete notification error:', error);
        toast('حدث خطأ', 'تعذر حذف الإشعار', 'error');
        return;
      }

      // حذف الإشعار من القائمة الحالية مباشرة
      State.notifications = State.notifications.filter(
        n => n.id !== notificationId
      );

      renderNotifications();

      toast(
        'تم الحذف',
        'تم حذف الإشعار',
        'success'
      );
    });
  });
}

/* ============== Boot ============== */
window.addEventListener('DOMContentLoaded', async () => {
  cacheLoad(); applyTheme();
  renderFooterSocial();
  initLogin(); initShell(); initMobileBack();
  setTimeout(async () => {
    $('#loadingScreen').classList.add('fade-out');
    setTimeout(()=>$('#loadingScreen').remove(), 400);
    if (!sb) {
      $('#loginPage').classList.remove('hidden');
      toast('Supabase غير مفعّل','عدّل env.js وأعد التحميل','warning');
      return;
    }
    // try ensure default admin (silent)
    ensureDefaultAdmin().catch(()=>{});
    // restore session
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      try { await afterLogin(); }
      catch(e){ console.error(e); $('#loginPage').classList.remove('hidden'); }
    } else {
      $('#loginPage').classList.remove('hidden');
    }
    // listen for auth changes
    sb.auth.onAuthStateChange(async (_e, sess) => {
      if (sess && !State.user) { try { await afterLogin(); } catch(e){ console.error(e); } }
    });
  }, 600);
});












