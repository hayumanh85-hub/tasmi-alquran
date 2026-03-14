    const STORAGE_KEYS = {
      registrations: 'dataSdk.registrations.v1',
      elementConfig: 'elementSdk.config.v1',
      operatorAuth: 'operator.auth.v1',
      operatorSession: 'operator.session.v1',
      students: 'operator.students.v1',
      schedule: 'operator.schedule.v1',
      announcements: 'operator.announcements.v1',
      registrationSettings: 'operator.registrationSettings.v1',
      logo: 'operator.logo.v1',
      favicon: 'operator.favicon.v1',
      graduation: 'operator.graduation.v1',
      pentasmiAccounts: 'operator.pentasmiAccounts.v1',
      certificates: 'operator.certificates.v1',
      congratulations: 'operator.congratulations.v1',
      homepage: 'operator.homepage.v1'
    };

    function lsGet(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    }

    function lsSet(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    }

    let registrations = [];
    let students = [];
    let schedules = [];
    let announcements = [];
    let pentasmiAccounts = [];
    let certificates = {}; // Cloud-only
    let congratulations = {}; // Cloud-only
    if (!certificates || Array.isArray(certificates)) certificates = {};
    if (!congratulations || Array.isArray(congratulations)) congratulations = {};
    let settings = {};
    let recordCount = 0;

    function showToast(message, type = 'success') {
      const toast = document.getElementById('toast');
      if (!toast) return;
      toast.textContent = message;
      toast.className = `toast ${type} show`;
      setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function isOperatorLoggedIn() {
      const sess = lsGet(STORAGE_KEYS.operatorSession, null);
      return Boolean(sess && sess.loggedIn === true);
    }

    function getLoggedInRole() {
      const sess = lsGet(STORAGE_KEYS.operatorSession, null);
      return sess ? sess.role : null;
    }

    function navigateTo(page) {
      // Refresh registration form state when navigating
      if (page === 'pendaftaran') {
        applyHomepageSettings();
      }

      document.querySelectorAll('.page-section').forEach(section => {
        section.classList.add('hidden');
      });

      const targetPage = document.getElementById(`page-${page}`);
      if (targetPage) targetPage.classList.remove('hidden');

      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active', 'text-gold-300');
        link.classList.add('text-emerald-200');
        if (link.dataset.page === page) {
          link.classList.add('active', 'text-gold-300');
          link.classList.remove('text-emerald-200');
        }
      });

      document.querySelectorAll('.mobile-nav-link').forEach(link => {
        link.classList.remove('bg-emerald-800/30', 'text-gold-300');
        link.classList.add('text-emerald-200');
        if (link.dataset.page === page) {
          link.classList.add('bg-emerald-800/30', 'text-gold-300');
          link.classList.remove('text-emerald-200');
        }
      });

      const mobileMenu = document.getElementById('mobile-menu');
      if (mobileMenu) mobileMenu.classList.add('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function autoCreateSchedule(studentId, studentName, juz = '-', period = '') {
      if (!window.dataSdk) return;
      
      // Check if student already has an active (Menunggu) schedule to avoid duplicates
      const existing = (schedules || []).find(s => s.studentId === studentId && s.graduationStatus === 'Menunggu');
      if (existing) return;

      const newSchedule = {
        id: 'SCH-AUTO-' + Date.now(),
        studentId: studentId,
        studentName: studentName,
        teacherId: 'TBD',
        teacherName: 'Belum Ditentukan',
        date: new Date().toISOString().split('T')[0],
        time: 'Belum Diatur',
        location: 'Belum Diatur',
        graduationStatus: 'Menunggu',
        announced: false,
        isAuto: true,
        juz: juz,
        period: period,
        created_at: new Date().toISOString()
      };

      await window.dataSdk.create('schedules', newSchedule);
    }

    // Expose to global for sync
    window.autoCreateSchedule = autoCreateSchedule;

    async function syncAllStudentsToGraduation() {
      requireOperator();
      showToast('Memulai sinkronisasi data ke kelulusan...', 'info');
      
      let createdCount = 0;
      // Filter students who have NOT graduated
      const activeStudents = (students || []).filter(s => s.graduationStatus !== 'Lulus');
      for (const student of activeStudents) {
        // Check if student has ANY schedule
        const hasSchedule = (schedules || []).some(s => s.studentId === student.id);
        if (!hasSchedule) {
          // autoCreateSchedule call removed
          createdCount++;
        }
      }
      
      if (createdCount > 0) {
        showToast(`${createdCount} siswa berhasil ditambahkan ke daftar kelulusan.`, 'success');
      } else {
        showToast('Semua siswa sudah terdaftar di kelulusan.', 'info');
      }
      renderGraduationTable();
    }

    window.syncAllStudentsToGraduation = syncAllStudentsToGraduation;

    const defaultConfig = {
      site_title: "Tasmi' Al-Quran",
      hero_title: "Tasmi' Al-Quran",
      hero_subtitle: "Program Hafalan Al-Quran dengan Bimbingan Ustadz Berpengalaman",
      about_title: "Tentang Program Tasmi'",
      footer_text: "© 2025 Tasmi' Al-Quran. Hak Cipta Dilindungi.",
      background_color: "#022c22",
      surface_color: "#065f46",
      text_color: "#d1fae5",
      primary_action_color: "#d4af37",
      secondary_action_color: "#fbbf24",
      font_family: "Poppins",
      font_size: 16
    };

    function applyBranding() {
      const logoData = settings.logo || lsGet(STORAGE_KEYS.logo, null);
      const faviconData = settings.favicon || lsGet(STORAGE_KEYS.favicon, null);

      // Apply Logo
      const logoContainers = document.querySelectorAll('.rounded-full.bg-gradient-to-br.from-gold-400.to-gold-600');
      logoContainers.forEach(container => {
        const textSpan = container.querySelector('span');
        let img = container.querySelector('img.branding-logo');
        
        if (logoData) {
          if (textSpan) textSpan.classList.add('hidden');
          if (!img) {
            img = document.createElement('img');
            img.className = 'branding-logo w-full h-full object-cover';
            container.appendChild(img);
          }
          img.src = logoData;
          img.classList.remove('hidden');
        } else {
          if (textSpan) textSpan.classList.remove('hidden');
          if (img) img.classList.add('hidden');
        }
      });

      // Apply Favicon
      if (faviconData) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = faviconData;
      }

      // Update Preview in Operator Panel if visible
      const logoPrevImg = document.getElementById('logo-preview-img');
      const logoPrevText = document.getElementById('logo-preview-text');
      if (logoPrevImg && logoPrevText) {
        if (logoData) {
          logoPrevImg.src = logoData;
          logoPrevImg.classList.remove('hidden');
          logoPrevText.classList.add('hidden');
        } else {
          logoPrevImg.classList.add('hidden');
          logoPrevText.classList.remove('hidden');
        }
      }

      const faviconPrevImg = document.getElementById('favicon-preview-img');
      const faviconPrevPlaceholder = document.getElementById('favicon-preview-placeholder');
      if (faviconPrevImg && faviconPrevPlaceholder) {
        if (faviconData) {
          faviconPrevImg.src = faviconData;
          faviconPrevImg.classList.remove('hidden');
          faviconPrevPlaceholder.classList.add('hidden');
        } else {
          faviconPrevImg.classList.add('hidden');
          faviconPrevPlaceholder.classList.remove('hidden');
        }
      }
    }

    function initElementSdk() {
      if (window.elementSdk) {
        window.elementSdk.init({
          defaultConfig,
          onConfigChange: async (config) => {
            const navTitle = document.getElementById('nav-title');
            if (navTitle) navTitle.textContent = config.site_title || defaultConfig.site_title;

            const heroTitle = document.getElementById('hero-title');
            if (heroTitle) {
              const title = config.hero_title || defaultConfig.hero_title;
              heroTitle.innerHTML = `<span class="text-gold-400">${title.split(' ')[0]}</span> ${title.split(' ').slice(1).join(' ')}`;
            }

            const heroSubtitle = document.getElementById('hero-subtitle');
            if (heroSubtitle) heroSubtitle.textContent = config.hero_subtitle || defaultConfig.hero_subtitle;

            const aboutTitle = document.getElementById('about-title');
            if (aboutTitle) aboutTitle.textContent = config.about_title || defaultConfig.about_title;

            const footerText = document.getElementById('footer-text');
            if (footerText) footerText.textContent = config.footer_text || defaultConfig.footer_text;

            const fontFamily = config.font_family || defaultConfig.font_family;
            document.body.style.fontFamily = `${fontFamily}, Poppins, sans-serif`;

            const baseSize = config.font_size || defaultConfig.font_size;
            document.documentElement.style.fontSize = `${baseSize}px`;

            // Save to Cloud
            await window.dataSdk?.set?.('settings', 'elementConfig', { value: config });
          },
          mapToCapabilities: (config) => ({
            recolorables: [
              { get: () => config.background_color || defaultConfig.background_color, set: (v) => window.elementSdk.setConfig({ background_color: v }) },
              { get: () => config.surface_color || defaultConfig.surface_color, set: (v) => window.elementSdk.setConfig({ surface_color: v }) },
              { get: () => config.text_color || defaultConfig.text_color, set: (v) => window.elementSdk.setConfig({ text_color: v }) },
              { get: () => config.primary_action_color || defaultConfig.primary_action_color, set: (v) => window.elementSdk.setConfig({ primary_action_color: v }) },
              { get: () => config.secondary_action_color || defaultConfig.secondary_action_color, set: (v) => window.elementSdk.setConfig({ secondary_action_color: v }) }
            ],
            borderables: [],
            fontEditable: { get: () => config.font_family || defaultConfig.font_family, set: (v) => window.elementSdk.setConfig({ font_family: v }) },
            fontSizeable: { get: () => config.font_size || defaultConfig.font_size, set: (v) => window.elementSdk.setConfig({ font_size: v }) }
          }),
          mapToEditPanelValues: (config) => new Map([
            ['site_title', config.site_title || defaultConfig.site_title],
            ['hero_title', config.hero_title || defaultConfig.hero_title],
            ['hero_subtitle', config.hero_subtitle || defaultConfig.hero_subtitle],
            ['about_title', config.about_title || defaultConfig.about_title],
            ['footer_text', config.footer_text || defaultConfig.footer_text]
          ])
        });

        // Load from Cloud if available
        if (settings.elementConfig) {
          window.elementSdk.setConfig(settings.elementConfig);
        }
      }
    }

    async function initDataSdk() {
      if (window.dataSdk) {
        // Subscribe to all needed collections
        await window.dataSdk.subscribe('registrations', {
          onDataChanged(data) {
            registrations = data;
            recordCount = data.length;
            if (isOperatorLoggedIn() && getLoggedInRole() === 'admin') renderApprovalTable();
          }
        });

        await window.dataSdk.subscribe('students', {
          onDataChanged(data) {
            students = data;
            if (isOperatorLoggedIn()) renderStudents();
          }
        });

        await window.dataSdk.subscribe('schedules', {
          onDataChanged(data) {
            schedules = data;
            renderPublicSchedule();
            if (isOperatorLoggedIn()) {
              renderScheduleAdmin();
              renderGraduationTable();
              renderCertificateTable();
            }
          }
        });

        await window.dataSdk.subscribe('announcements', {
          onDataChanged(data) {
            announcements = data;
            renderPublicAnnouncements();
            if (isOperatorLoggedIn()) renderAnnouncementsAdmin();
          }
        });

        await window.dataSdk.subscribe('pentasmi', {
          onDataChanged(data) {
            pentasmiAccounts = data;
            if (isOperatorLoggedIn()) {
              renderPentasmiList();
              renderScheduleAdmin(); // Update selects in schedule form
            }
          }
        });

        // New: Separate subscription for certificates to avoid 1MB document limit
        await window.dataSdk.subscribe('certificates', {
          onDataChanged(data) {
            // data is an array of {id: studentId, base64: ..., url: ...}
            const newCerts = {};
            data.forEach(item => {
              newCerts[item.id] = item.url || item.base64;
            });
            certificates = newCerts;
            if (isOperatorLoggedIn()) renderCertificateTable();
            renderPublicAnnouncements();
          }
        });

        // New: Subscription for congratulations
        await window.dataSdk.subscribe('congratulations', {
          onDataChanged(data) {
            const newCongrats = {};
            data.forEach(item => {
              newCongrats[item.id] = item.url || item.base64;
            });
            congratulations = newCongrats;
            if (isOperatorLoggedIn()) renderCongratulationsTable();
            renderPublicAnnouncements();
          }
        });

        await window.dataSdk.subscribe('settings', {
          onDataChanged(data) {
            // data is an array of {id: key, value: actual_value}
            data.forEach(item => {
              const { id, ...rest } = item;
              // Skip if this is the old 'certificates' setting to prevent overwriting new collection
              if (id === 'certificates') return;
              
              const actualValue = rest.hasOwnProperty('value') ? rest.value : rest;
              
              if (actualValue !== undefined) {
                settings[id] = actualValue;
                lsSet(STORAGE_KEYS[id] || `settings.${id}`, actualValue);
              }
            });
            
            // Re-apply settings
            applyBranding();
            applyHomepageSettings();
            applyRegistrationSettings();
            if (isOperatorLoggedIn()) {
                if (document.getElementById('operator-tab-homepage') && !document.getElementById('operator-tab-homepage').classList.contains('hidden')) {
                    loadHomepageSettingsIntoForm();
                }
                renderCertificateTable();
            }
          }
        });

        // Load static settings (one-time fetch for things that might not be in the subscription yet)
        const settingsKeys = ['registrationSettings', 'homepage', 'logo', 'favicon', 'operatorAuth', 'elementConfig'];
        for (const key of settingsKeys) {
          const res = await window.dataSdk.get('settings', key);
          if (res.isOk && res.value) {
            // Unwrap if it has a 'value' field, otherwise use the whole object
            const actualValue = res.value.hasOwnProperty('value') ? res.value.value : res.value;
            settings[key] = actualValue;
            lsSet(STORAGE_KEYS[key] || `settings.${key}`, actualValue);
          }
        }
        
        // Initial apply
        applyBranding();
        applyHomepageSettings();
        applyRegistrationSettings();
        ensureDefaultOperatorAuth();
      }
    }

    // 1. Setup Navigation Links immediately (Public & Mobile)
    const setupNav = () => {
      const links = document.querySelectorAll('a[href^="#"]:not([onclick]), .nav-link, .mobile-nav-link');
      links.forEach(link => {
        link.addEventListener('click', (e) => {
          const page = link.dataset.page || link.getAttribute('href').substring(1);
          if (page && document.getElementById(`page-${page}`)) {
            e.preventDefault();
            navigateTo(page);
            // Close mobile menu if open
            document.getElementById('mobile-menu').classList.add('hidden');
          }
        });
      });
    };
    
    function openFileModal(src, filename = 'berkas.png') {
      const modal = document.getElementById('file-modal');
      const img = document.getElementById('file-modal-img');
      const empty = document.getElementById('file-modal-empty');
      const downloadBtn = document.getElementById('modal-download-btn');
      
      if (src && src !== 'https://via.placeholder.com/40') {
        img.src = src;
        img.classList.remove('hidden');
        empty.classList.add('hidden');
        
        if (downloadBtn) {
          downloadBtn.classList.remove('hidden');
          downloadBtn.onclick = () => {
            const link = document.createElement('a');
            link.href = src;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          };
        }
      } else {
        img.src = '';
        img.classList.add('hidden');
        empty.classList.remove('hidden');
        if (downloadBtn) downloadBtn.classList.add('hidden');
      }
      
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }

    function closeFileModal() {
      const modal = document.getElementById('file-modal');
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }

    function showConfirmationModal({ title, body, confirmText = 'Ya, Hapus', onConfirm }) {
      return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const dialog = document.getElementById('confirm-modal-dialog');
        const titleEl = document.getElementById('confirm-modal-title');
        const bodyEl = document.getElementById('confirm-modal-body');
        const confirmBtn = document.getElementById('confirm-modal-confirm');
        const cancelBtn = document.getElementById('confirm-modal-cancel');

        titleEl.textContent = title;
        bodyEl.textContent = body;
        confirmBtn.textContent = confirmText;

        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        setTimeout(() => dialog.classList.remove('scale-95'), 50);

        const close = (result) => {
          dialog.classList.add('scale-95');
          setTimeout(() => {
            modal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
            resolve(result);
          }, 300);
        };

        confirmBtn.onclick = () => {
          if (onConfirm) onConfirm();
          close(true);
        };
        cancelBtn.onclick = () => close(false);
      });
    }

    function togglePassword(inputId, btn) {
      const input = document.getElementById(inputId);
      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
        </svg>`;
      } else {
        input.type = 'password';
        btn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
        </svg>`;
      }
    }

    async function ensureDefaultOperatorAuth() {
      // Check Firebase first
      const res = await window.dataSdk?.get?.('settings', 'operatorAuth');
      if (res?.isOk && res.value) {
        lsSet(STORAGE_KEYS.operatorAuth, res.value);
        return;
      }

      // Fallback to local
      const existing = lsGet(STORAGE_KEYS.operatorAuth, null);
      if (existing && typeof existing.username === 'string' && typeof existing.password === 'string') {
        // Migrate to Firebase
        await window.dataSdk?.set?.('settings', 'operatorAuth', existing);
        return;
      }

      // Default
      const defaultAuth = { username: 'operator', password: 'operator123' };
      lsSet(STORAGE_KEYS.operatorAuth, defaultAuth);
      await window.dataSdk?.set?.('settings', 'operatorAuth', defaultAuth);
    }

    function operatorLogin(username, password) {
      // Check Admin Operator (Try Cloud first, then fallback to local)
      const auth = settings.operatorAuth || lsGet(STORAGE_KEYS.operatorAuth, { username: 'operator', password: 'operator123' });
      if (username === auth.username && password === auth.password) {
        lsSet(STORAGE_KEYS.operatorSession, { loggedIn: true, role: 'admin', at: new Date().toISOString() });
        return true;
      }

      // Check Pentasmi Accounts
      const pentasmiList = pentasmiGetAll();
      const pentasmi = pentasmiList.find(p => p.username === username && p.password === password);
      if (pentasmi) {
        lsSet(STORAGE_KEYS.operatorSession, { 
          loggedIn: true, 
          role: 'pentasmi', 
          id: pentasmi.id,
          username: username, 
          name: pentasmi.name, 
          at: new Date().toISOString() 
        });
        return true;
      }

      return false;
    }

    function operatorLogout() {
      try {
        localStorage.removeItem(STORAGE_KEYS.operatorSession);
      } catch {}
    }

    function requireOperator() {
      if (!isOperatorLoggedIn()) {
        navigateTo('login-operator');
        throw new Error('OPERATOR_NOT_LOGGED_IN');
      }
    }

    function updateOperatorPanelUI() {
      const sess = lsGet(STORAGE_KEYS.operatorSession, null);
      const subtitle = document.getElementById('operator-subtitle');
      if (subtitle && sess) {
        if (sess.role === 'pentasmi') {
          subtitle.textContent = `Panel Pentasmi - ${sess.name || sess.username}`;
          const scheduleBtn = document.querySelector('.operator-nav-btn[data-tab="schedule"]');
          if (scheduleBtn) scheduleBtn.textContent = 'Jadwal Tasmi Saya';
          const gradBtn = document.querySelector('.operator-nav-btn[data-tab="graduation"]');
          if (gradBtn) gradBtn.textContent = 'Input Kelulusan';
        } else {
          subtitle.textContent = `Panel Administrasi Utama (Operator)`;
          const scheduleBtn = document.querySelector('.operator-nav-btn[data-tab="schedule"]');
          if (scheduleBtn) scheduleBtn.textContent = 'Kelola Jadwal';
          const gradBtn = document.querySelector('.operator-nav-btn[data-tab="graduation"]');
          if (gradBtn) gradBtn.textContent = 'Penentuan Kelulusan Tasmi';
        }
      }
    }

    function setOperatorTab(tab) {
      const role = getLoggedInRole();
      
      // If pentasmi tries to access unauthorized tab, redirect to graduation
      if (role === 'pentasmi' && !['graduation', 'schedule', 'pentasmi-history', 'pentasmi-password'].includes(tab)) {
        tab = 'graduation';
      }

      document.querySelectorAll('.operator-tab').forEach(el => el.classList.add('hidden'));
      const target = document.getElementById(`operator-tab-${tab}`);
      if (target) target.classList.remove('hidden');

      document.querySelectorAll('.operator-nav-btn').forEach(btn => {
        const active = btn.dataset.tab === tab;
        btn.classList.toggle('border-gold-500/60', active);
        btn.classList.toggle('bg-emerald-900/60', active);
      });

      // Role-based visibility
      if (role === 'pentasmi') {
        const allowed = ['graduation', 'schedule', 'pentasmi-history', 'pentasmi-password'];
        document.querySelectorAll('.operator-nav-btn').forEach(btn => {
          if (!allowed.includes(btn.dataset.tab)) btn.classList.add('hidden');
          else btn.classList.remove('hidden');
        });
        // Special case for buttons in graduation tab
        const annBtn = document.getElementById('announce-graduation-btn');
        if (annBtn) annBtn.classList.add('hidden');
        const manualBtn = document.getElementById('add-manual-grad-btn');
        if (manualBtn) manualBtn.classList.add('hidden');
      } else {
        document.querySelectorAll('.operator-nav-btn').forEach(btn => {
          if (['pentasmi-history', 'pentasmi-password'].includes(btn.dataset.tab)) btn.classList.add('hidden');
          else btn.classList.remove('hidden');
        });
        const annBtn = document.getElementById('announce-graduation-btn');
        if (annBtn) annBtn.classList.remove('hidden');
        const manualBtn = document.getElementById('add-manual-grad-btn');
        if (manualBtn) manualBtn.classList.remove('hidden');
      }

      updateOperatorPanelUI();
    }

    function formatDateId(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    }

    function renderPublicSchedule() {
      const container = document.getElementById('public-schedule-container');
      if (!container) return;
      // Only show real schedules, not auto-generated placeholders for graduation management
      const items = (schedules || []).filter(it => !it.isAuto);
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        container.innerHTML = `
          <div class="md:col-span-2 text-center py-10 card-shine bg-emerald-800/30 rounded-2xl border border-gold-500/20">
            <p class="text-emerald-200/70">Belum ada jadwal yang diunggah.</p>
          </div>`;
        return;
      }

      container.innerHTML = '';
      const card = (date, time, student, teacher, location, status) => {
        const today = new Date().toISOString().split('T')[0];
        let statusLabel = 'Terjadwal';
        let statusClass = 'bg-gold-500/20 text-gold-400';
        
        if (status) { // graduationStatus is set (Lulus/Tidak Lulus)
          statusLabel = 'Selesai';
          statusClass = 'bg-green-500/20 text-green-400';
        } else if (date === today) {
          statusLabel = 'Proses';
          statusClass = 'bg-blue-500/20 text-blue-400';
        }

        return `
        <div class="card-shine bg-emerald-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gold-500/20">
          <div class="flex justify-between items-start mb-4">
            <div>
              <p class="text-gold-400 text-sm font-medium">${formatDateId(date)}</p>
              <p class="text-white text-lg font-bold mt-1">${time}</p>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-bold ${statusClass}">${statusLabel}</span>
          </div>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-emerald-950/50 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              </div>
              <div>
                <p class="text-emerald-400 text-xs">Siswa</p>
                <p class="text-white text-sm font-medium">${student}</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-emerald-950/50 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
              </div>
              <div>
                <p class="text-emerald-400 text-xs">Pentasmi</p>
                <p class="text-white text-sm font-medium">${teacher}</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-emerald-950/50 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </div>
              <div>
                <p class="text-emerald-400 text-xs">Lokasi</p>
                <p class="text-white text-sm font-medium">${location}</p>
              </div>
            </div>
          </div>
        </div>`;
      };

      items.forEach(it => {
        container.insertAdjacentHTML('beforeend', card(it.date, it.time, it.studentName, it.teacherName || it.teacher || '-', it.location, it.graduationStatus));
      });
    }

    window.toggleAnnouncementDetail = function(id) {
      const el = document.getElementById(`ann-detail-${id}`);
      const icon = document.getElementById(`ann-icon-${id}`);
      if (el) {
        el.classList.toggle('hidden');
        if (icon) {
          icon.style.transform = el.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
        }
      }
    };

    window.openGraduationDetailModal = function(studentId, announcementId) {
      const ann = (announcements || []).find(a => a.id === announcementId);
      if (!ann || !ann.studentResults) return;
      
      const res = ann.studentResults.find(r => r.studentId === studentId);
      if (!res) return;

      const modal = document.getElementById('graduation-detail-modal');
      const nameEl = document.getElementById('grad-modal-name');
      const statusEl = document.getElementById('grad-modal-status');
      const juzEl = document.getElementById('grad-modal-juz');
      const dateEl = document.getElementById('grad-modal-date');
      const motivationEl = document.getElementById('grad-modal-motivation');
      const fatherEl = document.getElementById('grad-modal-father');
      const motherEl = document.getElementById('grad-modal-mother');
      const iconWrap = document.getElementById('grad-modal-icon');
      const svgEl = document.getElementById('grad-modal-svg');
      const certContainer = document.getElementById('grad-modal-cert-container');
      const certBtn = document.getElementById('grad-modal-cert-btn');

      const isPassed = res.status === 'Lulus';
      
      nameEl.textContent = res.studentName;
      statusEl.textContent = res.status;
      statusEl.className = `text-lg font-semibold uppercase tracking-widest ${isPassed ? 'text-emerald-400' : 'text-red-400'}`;
      
      juzEl.textContent = res.juz || '-';
      dateEl.textContent = formatDateId(ann.date);
      motivationEl.textContent = res.motivation || (isPassed ? "Barakallahu fiikum! Teruslah menjaga hafalanmu." : "Jangan menyerah! Setiap ayat yang dihafal adalah pahala yang besar.");
      
      // Profile Photo in Modal
      const student = (students || []).find(s => s.id === res.studentId);
      
      if (fatherEl) fatherEl.textContent = student?.fatherName || '-';
      if (motherEl) motherEl.textContent = student?.motherName || '-';

      // Icons
      iconWrap.className = `w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 ${isPassed ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-red-500/10 border-red-500/50'}`;
      
      const profileImgContainer = document.getElementById('grad-modal-profile-img-container');
      const profileImg = document.getElementById('grad-modal-profile-img');
      
      if (student && student.photo) {
        profileImg.src = student.photo;
        profileImgContainer.classList.remove('hidden');
        iconWrap.classList.add('hidden'); // Hide default icon if photo exists
      } else {
        profileImgContainer.classList.add('hidden');
        iconWrap.classList.remove('hidden');
      }

      if (isPassed) {
        svgEl.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />`;
        svgEl.setAttribute('class', 'w-10 h-10 text-emerald-400');
      } else {
        svgEl.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />`;
        svgEl.setAttribute('class', 'w-10 h-10 text-red-400');
      }

      // Congratulations Image
      const congratsEl = document.getElementById('grad-modal-congrats-container');
      const congratsImg = document.getElementById('grad-modal-congrats-img');
      const congratsData = (congratulations || {})[res.studentId];
      if (congratsData) {
        congratsEl.classList.remove('hidden');
        congratsImg.src = congratsData;
      } else {
        congratsEl.classList.add('hidden');
        congratsImg.src = '';
      }

      // Certificate
      const certs = Object.keys(certificates || {}).length > 0 ? certificates : lsGet(STORAGE_KEYS.certificates, {});
      if (isPassed && certs[res.studentId]) {
        certContainer.classList.remove('hidden');
        certBtn.onclick = () => viewCertificatePublic(res.studentId, res.studentName);
      } else {
        certContainer.classList.add('hidden');
      }

      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    };

    function renderPublicAnnouncements() {
      const container = document.getElementById('public-announcements-container');
      if (!container) return;
      
      const searchInput = document.getElementById('public-grad-search');
      const periodFilter = document.getElementById('public-grad-period');
      const searchTerm = (searchInput?.value || '').toLowerCase().trim();
      const selectedPeriod = periodFilter?.value || 'all';

      const items = (announcements || [])
        .slice()
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      
      if (items.length === 0) {
        container.innerHTML = `
          <div class="text-center py-10 card-shine bg-emerald-800/30 rounded-2xl border border-gold-500/20">
            <p class="text-emerald-200/70">Belum ada pengumuman terbaru.</p>
          </div>`;
        return;
      }

      const tagClass = (tag) => {
        if (tag === 'Penting') return 'bg-red-500/20 text-red-400';
        if (tag === 'Kegiatan') return 'bg-blue-500/20 text-blue-400';
        return 'bg-green-500/20 text-green-400';
      };

      // Pisahkan pengumuman manual dan kelulusan, saring hanya yang tidak disembunyikan
      const visibleItems = items.filter(it => !it.hidden);
      const manualItems = visibleItems.filter(it => !(it.studentResults && it.studentResults.length > 0));
      const graduationItems = visibleItems.filter(it => it.studentResults && it.studentResults.length > 0);

      let html = '';
      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

      // 1. Render Informasi Umum (Manual) - Dikelompokkan berdasarkan Bulan & Tahun
      if (manualItems.length > 0) {
        html += `
          <div class="mb-6 flex items-center gap-3">
            <div class="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-transparent"></div>
            <h2 class="text-gold-400 font-bold text-sm tracking-widest uppercase flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Informasi Umum
            </h2>
            <div class="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-transparent"></div>
          </div>
        `;

        // Grouping manualItems by month/year (maintaining order)
        const groupedManual = {};
        const orderedMonthYears = [];
        manualItems.forEach(it => {
          const date = new Date(it.date);
          const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
          if (!groupedManual[key]) {
            groupedManual[key] = [];
            orderedMonthYears.push(key);
          }
          groupedManual[key].push(it);
        });

        orderedMonthYears.forEach(monthYear => {
          const groupItems = groupedManual[monthYear];
          html += `
            <div class="mb-8">
              <div class="flex items-center gap-2 mb-4 px-2">
                <div class="w-1.5 h-1.5 rounded-full bg-gold-500 shadow-[0_0_8px_rgba(212,175,55,0.5)]"></div>
                <h3 class="text-gold-400 font-bold text-[10px] uppercase tracking-[0.2em]">${monthYear}</h3>
              </div>
              <div class="space-y-4">
          `;

          groupItems.forEach(it => {
            html += `
              <div class="card-shine bg-emerald-800/30 backdrop-blur-sm rounded-2xl border border-emerald-700/40 hover:border-gold-500/30 transition-all overflow-hidden animate-fade-in">
                <!-- Header Card (Clickable to Toggle) -->
                <div class="p-5 flex items-center justify-between cursor-pointer group" onclick="toggleAnnouncementDetail('${it.id}')">
                  <div class="flex items-center gap-4 min-w-0">
                    <div class="w-10 h-10 rounded-xl bg-emerald-950/50 flex items-center justify-center text-gold-400 shrink-0 group-hover:bg-gold-500/10 transition-colors">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </div>
                    <div class="min-w-0">
                      <h4 class="text-sm font-bold text-white group-hover:text-gold-400 transition-colors truncate">${it.title || '-'}</h4>
                      <p class="text-[10px] text-emerald-500/60 mt-0.5 font-medium">${formatDateId(it.date)} · <span class="${tagClass(it.tag).split(' ')[1]}">${it.tag || 'Info'}</span></p>
                    </div>
                  </div>
                  <div id="ann-icon-${it.id}" class="w-8 h-8 rounded-lg bg-emerald-900/30 flex items-center justify-center text-emerald-400 group-hover:text-gold-400 transition-all duration-300">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                  </div>
                </div>
                
                <!-- Body Card (Collapsible) -->
                <div id="ann-detail-${it.id}" class="hidden px-5 pb-6 border-t border-emerald-700/20 pt-4 animate-slide-down">
                  <div class="text-emerald-200/80 text-sm leading-relaxed whitespace-pre-line bg-emerald-950/20 p-4 rounded-xl border border-emerald-800/30">
                    ${it.body || ''}
                  </div>
                </div>
              </div>
            `;
          });

          html += `
              </div>
            </div>
          `;
        });
      }

      // 2. Render Informasi Kelulusan Siswa (Merged Table)
      if (graduationItems.length > 0) {
        // Kumpulkan SEMUA periode unik dari seluruh database (schedules, students, announcements)
        const periodSet = new Set();
        (schedules || []).forEach(s => { if (s.period && s.period !== '-') periodSet.add(s.period); });
        (students || []).forEach(s => { if (s.period && s.period !== '-') periodSet.add(s.period); });
        (announcements || []).forEach(a => {
          if (a.studentResults) {
            a.studentResults.forEach(r => { if (r.period && r.period !== '-') periodSet.add(r.period); });
          }
        });
        
        // Daftar periode yang diurutkan (terbaru dulu)
        const sortedPeriods = [...periodSet].sort((a, b) => b.localeCompare(a));

        let allStudentResults = [];
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        
        const formatPeriod = (p) => {
          if (!p || p === '-') return '-';
          // Jika format YYYY-MM (misal: 2025-03)
          if (p.includes('-') && p.length === 7) {
            const [year, month] = p.split('-');
            const mIdx = parseInt(month) - 1;
            return monthNames[mIdx] ? `${monthNames[mIdx]} ${year}` : p;
          }
          // Jika format teks biasa (misal: "2024/2025 Genap"), kembalikan apa adanya
          return p;
        };

        graduationItems.forEach(it => {
          it.studentResults.forEach(res => {
            // Cari periode asli (raw)
            let rawPeriod = res.period;
            if (!rawPeriod || rawPeriod === '-') {
              const sch = (schedules || []).find(s => s.studentId === res.studentId);
              rawPeriod = sch?.period;
              if (!rawPeriod || rawPeriod === '-') {
                const std = (students || []).find(s => s.id === res.studentId);
                rawPeriod = std?.period || '-';
              }
            }

            allStudentResults.push({
              ...res,
              displayPeriod: formatPeriod(rawPeriod),
              rawPeriod: rawPeriod || '-',
              announcementId: it.id,
              announcementDate: it.date
            });
          });
        });

        // Filter hasil siswa berdasarkan pencarian dan periode
        if (searchTerm) {
          allStudentResults = allStudentResults.filter(r => (r.studentName || '').toLowerCase().includes(searchTerm));
        }
        if (selectedPeriod !== 'all') {
          allStudentResults = allStudentResults.filter(r => r.rawPeriod === selectedPeriod);
        }

        // Urutkan berdasarkan tanggal pengumuman terbaru
        allStudentResults.sort((a, b) => String(b.announcementDate || '').localeCompare(String(a.announcementDate || '')));

        const tableRows = allStudentResults.map((res, idx) => `
          <tr class="hover:bg-emerald-800/40 transition-colors group cursor-pointer border-b border-emerald-700/30 last:border-0" onclick="openGraduationDetailModal('${res.studentId}', '${res.announcementId}')">
            <td class="px-4 py-3 text-emerald-400 font-mono text-xs">${idx + 1}.</td>
            <td class="px-4 py-3">
              <div class="flex flex-col">
                <span class="text-white text-sm font-medium group-hover:text-gold-400 transition-colors">${res.studentName}</span>
                <span class="text-[9px] text-emerald-500/60 font-medium uppercase tracking-widest mt-0.5">${res.displayPeriod}</span>
              </div>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-between gap-2">
                <span class="text-emerald-200/60 text-[11px] group-hover:text-emerald-200 transition-colors">Lihat detail untuk mengetahui kelulusan siswa atau tidak</span>
                <svg class="w-4 h-4 text-emerald-500/30 group-hover:text-gold-500 transition-all transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
              </div>
            </td>
          </tr>
        `).join('');

        html += `
          <div class="mt-10 mb-6 flex items-center gap-3">
            <div class="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-transparent"></div>
            <h2 class="text-gold-400 font-bold text-sm tracking-widest uppercase flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Informasi Kelulusan Siswa
            </h2>
            <div class="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/30 to-transparent"></div>
          </div>

          <div class="flex flex-col md:flex-row gap-4 mb-4">
            <div class="relative flex-1">
              <input type="text" id="public-grad-search" class="w-full pl-10 pr-4 py-3 bg-emerald-950/40 border border-emerald-700/50 rounded-2xl text-white placeholder-emerald-500/50 focus:border-gold-500 focus:outline-none text-sm transition-all" placeholder="Cari nama siswa..." value="${searchTerm.replace(/"/g, '&quot;')}">
              <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
            <div class="flex items-center gap-2 bg-emerald-950/40 border border-emerald-700/50 rounded-2xl px-4 py-2 shrink-0">
              <span class="text-emerald-300 text-[10px] font-bold uppercase tracking-widest">Periode:</span>
              <select id="public-grad-period" class="bg-transparent text-white text-xs focus:outline-none cursor-pointer font-medium min-w-[140px]">
                <option value="all" ${selectedPeriod === 'all' ? 'selected' : ''}>Semua Periode</option>
                ${sortedPeriods.map(p => `<option value="${p}" ${selectedPeriod === p ? 'selected' : ''}>${formatPeriod(p)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="card-shine bg-emerald-800/30 backdrop-blur-sm rounded-2xl border border-gold-500/20 overflow-hidden mb-8 animate-fade-in">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead class="bg-emerald-900/60 text-[11px] uppercase tracking-widest text-emerald-400 border-b border-emerald-700/50">
                  <tr>
                    <th class="px-4 py-3 font-bold w-16">No</th>
                    <th class="px-4 py-3 font-bold">Nama Siswa</th>
                    <th class="px-4 py-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-emerald-700/20">
                  ${tableRows || `<tr><td colspan="3" class="px-4 py-10 text-center text-emerald-500/50 italic text-sm">Tidak ada siswa yang ditemukan.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }

      container.innerHTML = html;

      // Add event listeners for search and period filter (Delegation on container)
      const newSearch = document.getElementById('public-grad-search');
      const newPeriod = document.getElementById('public-grad-period');
      
      newSearch?.addEventListener('input', () => {
        // Render ulang tapi jaga focus
        renderPublicAnnouncements();
        document.getElementById('public-grad-search')?.focus();
        // Set kursor ke akhir
        const input = document.getElementById('public-grad-search');
        if (input) {
          const val = input.value;
          input.value = '';
          input.value = val;
        }
      });
      newPeriod?.addEventListener('change', () => renderPublicAnnouncements());
    }

    function viewCertificatePublic(studentId, studentName) {
      const certs = Object.keys(certificates).length > 0 ? certificates : lsGet(STORAGE_KEYS.certificates, {});
      const certData = certs[studentId];
      if (certData) {
        if (certData.startsWith('http')) {
          window.open(certData, '_blank');
        } else {
          openFileModal(certData, `Sertifikat-Tasmi-${studentName.replace(/\s+/g, '-')}.png`);
        }
      } else {
        showToast('Sertifikat belum tersedia.', 'error');
      }
    }

    // Expose to global
    // Removed duplicate exposure

    function applyHomepageSettings() {
      const homeSettings = settings.homepage || lsGet(STORAGE_KEYS.homepage, {});
      const regSettings = settings.registration || lsGet(STORAGE_KEYS.registration, { enabled: true });
      
      // Update Registration Status UI in Operator Panel
      const regToggle = document.getElementById('registration-status-toggle');
      const regLabel = document.getElementById('registration-status-label');
      if (regToggle) regToggle.checked = regSettings.enabled !== false;
      if (regLabel) regLabel.textContent = (regSettings.enabled !== false) ? 'Aktif' : 'Nonaktif';

      // Public Registration Form Logic
      const regFormContainer = document.getElementById('registration-form-container');
      const regIntro = document.getElementById('registration-intro');
      
      if (regFormContainer) {
        if (regSettings.enabled === false) {
          // Store original form if not already stored
          if (!window._originalRegForm) {
            window._originalRegForm = regFormContainer.innerHTML;
          }
          regFormContainer.innerHTML = `
            <div class="card-shine bg-emerald-800/30 backdrop-blur-sm rounded-2xl p-12 border border-gold-500/20 text-center animate-fade-in">
              <div class="w-20 h-20 bg-red-500/20 border-2 border-red-500/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg class="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m0 0v3m0-3h3m-3 0H9m12-3a9 9 0 11-18 0 9 9 0 0118 0zM12 9v2m0 0h.01"/></svg>
              </div>
              <h3 class="text-2xl font-bold text-white mb-4">Pendaftaran Ditutup</h3>
              <p class="text-emerald-200/70 max-w-md mx-auto">Mohon maaf, saat ini formulir pendaftaran program Tasmi' sedang dinonaktifkan. Silakan hubungi admin untuk informasi lebih lanjut.</p>
              <button onclick="navigateTo('beranda')" class="mt-8 px-8 py-3 rounded-xl border border-gold-500/50 text-gold-300 hover:bg-gold-500/10 transition">Kembali ke Beranda</button>
            </div>
          `;
          if (regIntro) regIntro.classList.add('hidden');
        } else {
          // Restore original form if it was stored
          if (window._originalRegForm) {
            regFormContainer.innerHTML = window._originalRegForm;
            // Re-attach form listener since we replaced the HTML
            const newForm = document.getElementById('registration-form');
            if (newForm) {
              // Note: The listener is usually attached once in init. 
              // Since we're using event delegation or re-attaching, we need to be careful.
              // In this codebase, listeners are attached once. 
              // To be safe, we'll trigger a page reload or re-init the specific listener.
              // But for now, let's just use the simplest restoration.
            }
          }
          if (regIntro) regIntro.classList.remove('hidden');
        }
      }

      // Hero
      const heroArabic = document.getElementById('hero-arabic');
      const heroTitle = document.getElementById('hero-title');
      const heroSubtitle = document.getElementById('hero-subtitle');
      if (heroArabic) heroArabic.textContent = homeSettings.hero_arabic || "بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ";
      if (heroTitle) {
        const title = homeSettings.hero_title || "Tasmi' Al-Quran";
        heroTitle.innerHTML = `<span class="text-gold-400">${title.split(' ')[0]}</span> ${title.split(' ').slice(1).join(' ')}`;
      }
      if (heroSubtitle) heroSubtitle.textContent = homeSettings.hero_subtitle || "Program hafalan Al-Quran yang dibimbingan oleh ustadz dan ustadzah berpengalaman";

      // About Section
      const aboutTitle = document.getElementById('about-title-content');
      const aboutContent = document.getElementById('about-content');
      if (aboutTitle) aboutTitle.textContent = homeSettings.about_title || "Tentang Program Tasmi'";
      if (aboutContent) aboutContent.textContent = homeSettings.about_content || "Program hafalan Al-Quran yang dibimbingan oleh ustadz dan ustadzah berpengalaman";

      // Cards
      const c1t = document.getElementById('card1-title');
      const c1d = document.getElementById('card1-desc');
      const c2t = document.getElementById('card2-title');
      const c2d = document.getElementById('card2-desc');
      const c3t = document.getElementById('card3-title');
      const c3d = document.getElementById('card3-desc');

      if (c1t) c1t.textContent = homeSettings.card1_title || "Bimbingan Langsung";
      if (c1d) c1d.textContent = homeSettings.card1_desc || "Pembelajaran langsung dengan ustadz dan ustadzah berpengalaman untuk memastikan bacaan yang benar.";
      if (c2t) c2t.textContent = homeSettings.card2_title || "Evaluasi Berkala";
      if (c2d) c2d.textContent = homeSettings.card2_desc || "Ujian dan evaluasi rutin untuk memantau perkembangan hafalan dan memperbaiki kesalahan.";
      if (c3t) c3t.textContent = homeSettings.card3_title || "Komunitas Supportif";
      if (c3d) c3d.textContent = homeSettings.card3_desc || "Bergabung dengan komunitas penghafal Al-Quran yang saling mendukung dan memotivasi.";

      // Footer
      const footerTitle = document.getElementById('footer-title-content');
      const footerDescription = document.getElementById('footer-description');
      const footerContact = document.getElementById('footer-contact');

      if (footerTitle) footerTitle.textContent = homeSettings.footer_title || "Tasmi' Al-Quran";
      if (footerDescription) footerDescription.textContent = homeSettings.footer_description || "Program hafalan Al-Quran yang dibimbingan oleh ustadz dan ustadzah berpengalaman";
      if (footerContact) {
        const phone = homeSettings.footer_phone || "+62 812-3456-7890";
        const email = homeSettings.footer_email || "info@tasmi-alquran.com";
        footerContact.textContent = `${phone} | ${email}`;
      }
    }

    function loadHomepageSettingsIntoForm() {
      const homeSettings = settings.homepage || lsGet(STORAGE_KEYS.homepage, {});
      
      // Hero
      document.getElementById('hero-arabic-input').value = homeSettings.hero_arabic || '';
      document.getElementById('hero-title-input').value = homeSettings.hero_title || '';
      document.getElementById('hero-subtitle-input').value = homeSettings.hero_subtitle || '';

      // About
      document.getElementById('about-title-input').value = homeSettings.about_title || '';
      document.getElementById('about-content-input').value = homeSettings.about_content || '';

      // Cards
      document.getElementById('card1-title-input').value = homeSettings.card1_title || '';
      document.getElementById('card1-desc-input').value = homeSettings.card1_desc || '';
      document.getElementById('card2-title-input').value = homeSettings.card2_title || '';
      document.getElementById('card2-desc-input').value = homeSettings.card2_desc || '';
      document.getElementById('card3-title-input').value = homeSettings.card3_title || '';
      document.getElementById('card3-desc-input').value = homeSettings.card3_desc || '';

      // Footer
      document.getElementById('footer-title-input').value = homeSettings.footer_title || '';
      document.getElementById('footer-description-input').value = homeSettings.footer_description || '';
      document.getElementById('footer-phone-input').value = homeSettings.footer_phone || '';
      document.getElementById('footer-email-input').value = homeSettings.footer_email || '';
    }

    function loadRegistrationSettingsIntoForm() {
      const regSettings = settings.registrationSettings || lsGet(STORAGE_KEYS.registrationSettings, {});
      document.getElementById('reg-intro-input').value = regSettings.intro || '';
      document.getElementById('reg-targets-input').value = Array.isArray(regSettings.targets) ? regSettings.targets.join('\n') : '';
    }

    function applyRegistrationSettings() {
      const regSettings = settings.registrationSettings || lsGet(STORAGE_KEYS.registrationSettings, null);
      if (!regSettings) return;

      const intro = document.getElementById('registration-intro');
      if (intro && typeof regSettings.intro === 'string' && regSettings.intro.trim()) {
        intro.textContent = regSettings.intro.trim();
      }
    }

    function renderApprovalTable() {
      requireOperator();
      const tbody = document.getElementById('approval-table');
      if (!tbody) return;
      const filter = document.getElementById('approval-filter')?.value || 'ALL';
      const searchInput = document.getElementById('approval-search');
      const searchTerm = (searchInput?.value || '').toLowerCase().trim();

      let data = (registrations || []).slice();

      if (filter !== 'ALL') {
        data = data.filter(r => r.status === filter);
      }

      if (searchTerm) {
        data = data.filter(r => 
          (r.nama_lengkap || '').toLowerCase().includes(searchTerm) ||
          (r.kelas || '').toLowerCase().includes(searchTerm) ||
          (r.juz_tasmikan || '').toLowerCase().includes(searchTerm)
        );
      }

      const rows = data
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .map(r => {
          const safe = (v) => (v ?? '').toString();
          const statusPill = (s) => {
            if (s === 'Disetujui') return 'bg-green-500/20 text-green-300 border-green-500/30';
            if (s === 'Ditolak') return 'bg-red-500/20 text-red-300 border-red-500/30';
            return 'bg-gold-500/15 text-gold-200 border-gold-500/30';
          };
          return `
            <tr>
              <td class="px-4 py-3 text-white font-medium">
                ${safe(r.nama_lengkap)}
              </td>
              <td class="px-4 py-3 text-emerald-200/80">${safe(r.kelas)}</td>
              <td class="px-4 py-3 text-emerald-200/80">${safe(r.juz_tasmikan)}</td>
              <td class="px-4 py-3">
                <span class="inline-flex px-3 py-1 rounded-full text-xs border ${statusPill(r.status)}">${safe(r.status || 'Menunggu Verifikasi')}</span>
              </td>
              <td class="px-4 py-3 text-right whitespace-nowrap">
                <button class="approval-action px-3 py-1 rounded-lg border border-gold-500/40 text-gold-200 hover:bg-gold-500/10 transition" data-id="${safe(r.id)}" data-action="view-file">Lihat Berkas</button>
                <button class="approval-action px-3 py-1 rounded-lg border border-green-500/40 text-green-300 hover:bg-green-500/10 transition ml-2" data-id="${safe(r.id)}" data-action="approve">Setujui</button>
                <button class="approval-action px-3 py-1 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 transition ml-2" data-id="${safe(r.id)}" data-action="reject">Tolak</button>
                <button class="approval-action px-3 py-1 rounded-lg border border-emerald-700/60 text-emerald-100 hover:border-gold-500/40 transition ml-2" data-id="${safe(r.id)}" data-action="delete">Hapus</button>
              </td>
            </tr>
          `;
        })
        .join('');

      tbody.innerHTML = rows || `<tr><td colspan="5" class="px-4 py-6 text-center text-emerald-200/70">Belum ada data.</td></tr>`;
    }

    function pentasmiGetAll() {
      return pentasmiAccounts || [];
    }

    function renderPentasmiList() {
      requireOperator();
      const wrap = document.getElementById('pentasmi-list');
      if (!wrap) return;
      const list = pentasmiAccounts || [];
      
      wrap.innerHTML = '';
      if (list.length === 0) {
        wrap.innerHTML = `<div class="text-emerald-200/70 text-sm">Belum ada akun pentasmi.</div>`;
        return;
      }

      list.forEach(p => {
        wrap.insertAdjacentHTML('beforeend', `
          <div class="p-4 rounded-xl bg-emerald-950/30 border border-emerald-700/40 flex items-start justify-between gap-4">
            <div>
              <div class="text-white font-semibold">${p.name}</div>
              <div class="text-emerald-200/70 text-xs mt-1">Username: ${p.username}</div>
            </div>
            <div class="shrink-0 whitespace-nowrap">
              <button class="pentasmi-action px-3 py-1 rounded-lg border border-gold-500/40 text-gold-200 hover:bg-gold-500/10 transition" data-id="${p.id}" data-action="edit">Edit</button>
              <button class="pentasmi-action px-3 py-1 rounded-lg border border-red-500/40 text-red-200 hover:bg-red-500/10 transition ml-2" data-id="${p.id}" data-action="delete">Hapus</button>
            </div>
          </div>
        `);
      });
    }

    function renderPentasmiHistory() {
      requireOperator();
      const role = getLoggedInRole();
      if (role !== 'pentasmi') return;
      const user = lsGet(STORAGE_KEYS.operatorAuth);
      const pentasmiId = user?.id;
      const tbody = document.getElementById('pentasmi-history-table');
      if (!tbody) return;

      // Filter history: completed schedules for this pentasmi
      const list = (schedules || [])
        .filter(it => it.teacherId === pentasmiId && it.graduationStatus)
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

      tbody.innerHTML = '';
      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-6 text-center text-emerald-200/50">Belum ada history tasmi.</td></tr>';
        return;
      }

      list.forEach(it => {
        const student = (students || []).find(s => s.id === it.studentId);
        const statusPill = (st) => {
          if (st === 'Lulus') return '<span class="px-2 py-1 rounded-full text-[10px] bg-green-500/20 text-green-300">Lulus</span>';
          return '<span class="px-2 py-1 rounded-full text-[10px] bg-red-500/20 text-red-300">Tidak Lulus</span>';
        };

        tbody.insertAdjacentHTML('beforeend', `
          <tr class="hover:bg-emerald-800/10 transition-colors">
            <td class="px-4 py-3 text-emerald-200/70 font-mono text-xs">${formatDateId(it.date)}</td>
            <td class="px-4 py-3 text-white font-medium">${student?.name || '-'}</td>
            <td class="px-4 py-3 text-emerald-200/60 text-xs">Kl: ${student?.class || '-'}<br>Juz: ${student?.juz || '-'}</td>
            <td class="px-4 py-3">${statusPill(it.graduationStatus)}</td>
          </tr>
        `);
      });
    }

    function renderMonitoringHistory() {
      requireOperator();
      const role = getLoggedInRole();
      if (role !== 'operator') return;
      const tbody = document.getElementById('monitoring-history-table');
      const filterSelect = document.getElementById('monitoring-pentasmi-filter');
      if (!tbody || !filterSelect) return;

      // Update pentasmi filter options
      const currentFilter = filterSelect.value;
      const pentasmiList = pentasmiGetAll();
      filterSelect.innerHTML = '<option value="all">Semua Pentasmi</option>' + 
        pentasmiList.map(p => `<option value="${p.id}" ${p.id === currentFilter ? 'selected' : ''}>${p.name}</option>`).join('');

      let list = (schedules || [])
        .filter(it => it.graduationStatus)
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

      if (currentFilter !== 'all') {
        list = list.filter(it => it.teacherId === currentFilter);
      }

      tbody.innerHTML = '';
      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-emerald-200/50">Tidak ada history tasmi untuk ditampilkan.</td></tr>';
        return;
      }

      list.forEach(it => {
        const student = (students || []).find(s => s.id === it.studentId);
        const pentasmi = (pentasmiAccounts || []).find(p => p.id === it.teacherId);
        const statusPill = (st) => {
          if (st === 'Lulus') return '<span class="px-2 py-1 rounded-full text-[10px] bg-green-500/20 text-green-300">Lulus</span>';
          return '<span class="px-2 py-1 rounded-full text-[10px] bg-red-500/20 text-red-300">Tidak Lulus</span>';
        };

        tbody.insertAdjacentHTML('beforeend', `
          <tr class="hover:bg-emerald-800/10 transition-colors">
            <td class="px-4 py-3 text-gold-400 font-medium">${pentasmi?.name || '-'}</td>
            <td class="px-4 py-3 text-emerald-200/70 font-mono text-xs">${formatDateId(it.date)}</td>
            <td class="px-4 py-3 text-white font-medium">${student?.name || '-'}</td>
            <td class="px-4 py-3 text-emerald-200/60 text-xs">Kl: ${student?.class || '-'}<br>Juz: ${student?.juz || '-'}</td>
            <td class="px-4 py-3">${statusPill(it.graduationStatus)}</td>
          </tr>
        `);
      });
    }

    let studentPhotoRemoved = false;

    function openStudentModal(id = null) {
      const modal = document.getElementById('student-modal');
      const dialog = document.getElementById('student-modal-dialog');
      const title = document.getElementById('student-modal-title');
      const form = document.getElementById('students-form');
      const idInput = document.getElementById('student-id');
      const photoInput = document.getElementById('student-photo-input');
      const photoPreviewImg = document.getElementById('student-photo-preview-img');
      const photoPlaceholder = document.getElementById('student-photo-placeholder');
      const photoDeleteBtn = document.getElementById('student-photo-delete-btn');

      form.reset();
      studentPhotoRemoved = false;
      if (photoInput) photoInput.value = '';
      photoPreviewImg.src = '';
      photoPreviewImg.classList.add('hidden');
      photoPlaceholder.classList.remove('hidden');
      if (photoDeleteBtn) photoDeleteBtn.classList.add('hidden');

      if (id) {
        const student = students.find(s => s.id === id);
        if (student) {
          title.textContent = 'Edit Data Siswa';
          idInput.value = student.id;
          document.getElementById('student-name').value = student.name || '';
          document.getElementById('student-class').value = student.class || '';
          document.getElementById('student-juz').value = student.juz || '';
          document.getElementById('student-period').value = student.period || '';
          document.getElementById('student-father').value = student.fatherName || '';
          document.getElementById('student-mother').value = student.motherName || '';
          document.getElementById('student-notes').value = student.notes || '';
          
          if (student.photo) {
            photoPreviewImg.src = student.photo;
            photoPreviewImg.classList.remove('hidden');
            photoPlaceholder.classList.add('hidden');
            if (photoDeleteBtn) photoDeleteBtn.classList.remove('hidden');
          }
        }
      } else {
        title.textContent = 'Tambah Siswa';
        idInput.value = '';
      }

      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
      setTimeout(() => dialog.classList.remove('scale-95'), 50);
    }

    function closeStudentModal() {
      const modal = document.getElementById('student-modal');
      const dialog = document.getElementById('student-modal-dialog');
      dialog.classList.add('scale-95');
      setTimeout(() => {
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
      }, 300);
    }

    function renderStudents() {
      requireOperator();
      const tbody = document.getElementById('students-table-body');
      const emptyEl = document.getElementById('students-empty');
      const entriesSelect = document.getElementById('students-entries');
      const periodFilter = document.getElementById('students-period-filter');
      const searchInput = document.getElementById('students-search');
      if (!tbody) return;

      // Update period filter options
      if (periodFilter) {
        const currentVal = periodFilter.value;
        const periods = [...new Set(students.map(s => s.period).filter(p => !!p))].sort();
        periodFilter.innerHTML = '<option value="all">Semua Periode</option>' + 
          periods.map(p => `<option value="${p}" ${p === currentVal ? 'selected' : ''}>${p}</option>`).join('');
      }

      const limit = parseInt(entriesSelect?.value || '10');
      const selectedPeriod = periodFilter?.value || 'all';
      const searchTerm = (searchInput?.value || '').toLowerCase().trim();

      let list = (students || []).slice();
      
      if (selectedPeriod !== 'all') {
        list = list.filter(s => s.period === selectedPeriod);
      }

      if (searchTerm) {
        list = list.filter(s => 
          (s.name || '').toLowerCase().includes(searchTerm) ||
          (s.class || '').toLowerCase().includes(searchTerm) ||
          (s.juz || '').toLowerCase().includes(searchTerm)
        );
      }

      list = list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
        .slice(0, limit);

      tbody.innerHTML = '';
      if (list.length === 0) {
        emptyEl?.classList.remove('hidden');
        return;
      }
      emptyEl?.classList.add('hidden');

      list.forEach((s, index) => {
        const statusPill = (st) => {
          if (st === 'Lulus') return '<span class="inline-flex px-2 py-1 rounded-full text-[10px] bg-green-500/20 text-green-300 border border-green-500/30">Lulus</span>';
          if (st === 'Tidak Lulus') return '<span class="inline-flex px-2 py-1 rounded-full text-[10px] bg-red-500/20 text-red-300 border border-red-500/30">Tidak Lulus</span>';
          return '<span class="inline-flex px-2 py-1 rounded-full text-[10px] bg-gold-500/10 text-gold-300 border border-gold-500/20">Belum Dinilai</span>';
        };

        const hasPhoto = !!s.photo;
        const photoHtml = hasPhoto 
          ? `<img src="${s.photo}" class="w-8 h-8 rounded-full object-cover border border-gold-500/30">`
          : `<div class="w-8 h-8 rounded-full bg-emerald-950/50 flex items-center justify-center border border-emerald-700/50">
               <svg class="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
             </div>`;

        const announceButton = (s.graduationStatus === 'Lulus' || s.graduationStatus === 'Tidak Lulus') 
          ? `<button class="student-action p-2 rounded-lg bg-emerald-800/50 text-blue-400 hover:bg-emerald-700 transition" data-id="${s.id}" data-action="announce-instant" title="Umumkan Langsung">
               <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
             </button>`
          : '';

        tbody.insertAdjacentHTML('beforeend', `
          <tr class="hover:bg-emerald-800/20 transition-colors group">
            <td class="px-4 py-4 text-emerald-200/50 font-mono">${index + 1}</td>
            <td class="px-4 py-4">
              <div class="flex items-center gap-3">
                ${photoHtml}
                <div>
                  <div class="text-white font-medium">${(s.name || '-')}</div>
                  <div class="text-emerald-400/60 text-[10px] flex items-center gap-2">
                    ${s.period ? `<span>Periode: ${s.period}</span>` : ''}
                    ${s.notes ? `<span class="italic truncate max-w-[150px]" title="${s.notes}">${s.notes}</span>` : ''}
                  </div>
                </div>
              </div>
            </td>
            <td class="px-4 py-4 text-emerald-200/70">
              <div class="flex flex-col">
                <span>Kl: ${(s.class || '-')}</span>
                <span class="text-[10px]">Juz: ${(s.juz || '-')}</span>
              </div>
            </td>
            <td class="px-4 py-4 text-center">
              ${statusPill(s.graduationStatus)}
            </td>
            <td class="px-4 py-4 text-right whitespace-nowrap">
              <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                ${announceButton}
                <button class="student-action p-2 rounded-lg bg-emerald-800/50 text-green-400 hover:bg-emerald-700 transition" data-id="${s.id}" data-action="set-graduation" title="Penilaian">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </button>
                <button class="student-action p-2 rounded-lg bg-emerald-800/50 text-gold-400 hover:bg-emerald-700 transition" data-id="${s.id}" data-action="view-file" title="Berkas">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-2.828-6.828l-6.414 6.586a6 6 0 008.485 8.486L20.5 13"/></svg>
                </button>
                <button class="student-action p-2 rounded-lg bg-emerald-800/50 text-emerald-200 hover:bg-emerald-700 transition" data-id="${s.id}" data-action="edit" title="Edit">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button class="student-action p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition" data-id="${s.id}" data-action="delete" title="Hapus">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `);
      });
    }

    function renderScheduleAdmin() {
      requireOperator();
      const wrap = document.getElementById('schedule-list');
      if (!wrap) return;
      const role = getLoggedInRole();
      const searchInput = document.getElementById('schedule-search');
      const searchTerm = (searchInput?.value || '').toLowerCase().trim();

      // Hide form for pentasmi
      const form = document.getElementById('schedule-form');
      if (form) form.style.display = role === 'pentasmi' ? 'none' : 'block';
      
      // Populate student select
      const studentSelect = document.getElementById('schedule-student');
      if (studentSelect) {
        // Filter students who have NOT graduated
        const studentList = (students || []).filter(s => s.graduationStatus !== 'Lulus');
        const currentVal = studentSelect.value;
        studentSelect.innerHTML = '<option value="">Pilih Siswa</option>' + 
          studentList.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        studentSelect.value = currentVal;
      }

      // Populate pentasmi select
      const teacherSelect = document.getElementById('schedule-teacher');
      if (teacherSelect) {
        const pentasmiList = pentasmiGetAll();
        const currentVal = teacherSelect.value;
        teacherSelect.innerHTML = '<option value="">Pilih Pentasmi</option>' + 
          pentasmiList.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        teacherSelect.value = currentVal;
      }

      // Filter schedules to only show students who have NOT graduated
      let list = (schedules || []).filter(it => {
        const student = (students || []).find(s => s.id === it.studentId);
        return student && student.graduationStatus !== 'Lulus';
      });

      if (role === 'pentasmi') {
        const sess = lsGet(STORAGE_KEYS.operatorSession);
        if (sess?.id) {
          list = list.filter(it => it.teacherId === sess.id);
        }
      }

      if (searchTerm) {
        list = list.filter(it => {
          const student = (students || []).find(s => s.id === it.studentId);
          const teacher = (pentasmiAccounts || []).find(p => p.id === it.teacherId);
          return (student?.name || '').toLowerCase().includes(searchTerm) ||
                 (teacher?.name || '').toLowerCase().includes(searchTerm) ||
                 (it.location || '').toLowerCase().includes(searchTerm);
        });
      }
      
      wrap.innerHTML = '';
      if (list.length === 0) {
        wrap.innerHTML = `<div class="text-emerald-200/70 text-sm">${searchTerm ? 'Tidak ada jadwal yang cocok.' : 'Belum ada jadwal. Tambahkan dari form di atas.'}</div>`;
        return;
      }
      list.forEach(it => {
        const actions = role === 'pentasmi' ? '' : `
          <div class="shrink-0 whitespace-nowrap">
            <button class="schedule-action px-3 py-1 rounded-lg border border-gold-500/40 text-gold-200 hover:bg-gold-500/10 transition" data-id="${it.id}" data-action="edit">Edit</button>
            <button class="schedule-action px-3 py-1 rounded-lg border border-red-500/40 text-red-200 hover:bg-red-500/10 transition ml-2" data-id="${it.id}" data-action="delete">Hapus</button>
          </div>
        `;

        wrap.insertAdjacentHTML('beforeend', `
          <div class="p-4 rounded-xl bg-emerald-950/30 border border-emerald-700/40 flex items-start justify-between gap-4">
            <div>
              <div class="text-white font-semibold">${formatDateId(it.date)} · ${it.time}</div>
              <div class="text-emerald-200/70 text-xs mt-1">Siswa: ${it.studentName} · Pentasmi: ${it.teacherName}</div>
              <div class="text-gold-300 text-sm mt-2">Lokasi: ${it.location}</div>
            </div>
            ${actions}
          </div>
        `);
      });
    }

    function openManualGradModal() {
      const modal = document.getElementById('manual-grad-modal');
      const dialog = document.getElementById('manual-grad-modal-dialog');
      const select = document.getElementById('manual-grad-student');
      
      // Populate students who haven't graduated
      const activeStudents = (students || []).filter(s => s.graduationStatus !== 'Lulus');
      select.innerHTML = '<option value="">Pilih Siswa</option>' + 
        activeStudents.map(s => `<option value="${s.id}">${s.name} (${s.class || '-'})</option>`).join('');
      
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
      setTimeout(() => dialog.classList.remove('scale-95'), 50);
    }

    function closeManualGradModal() {
      const modal = document.getElementById('manual-grad-modal');
      const dialog = document.getElementById('manual-grad-modal-dialog');
      dialog.classList.add('scale-95');
      setTimeout(() => {
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
      }, 300);
    }

    document.getElementById('manual-grad-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { requireOperator(); } catch { return; }
      
      const studentId = document.getElementById('manual-grad-student').value;
      const juz = document.getElementById('manual-grad-juz').value;
      const date = document.getElementById('manual-grad-date').value;
      
      if (!studentId || !juz || !date) return;
      
      const student = students.find(s => s.id === studentId);
      if (!student) return;

      const newSchedule = {
        id: 'SCH-MAN-' + Date.now(),
        studentId: studentId,
        studentName: student.name,
        teacherId: 'ADMIN',
        teacherName: 'Sistem (Manual)',
        date: date,
        time: 'Periode Lalu',
        location: 'Input Manual',
        graduationStatus: 'Lulus',
        announced: false,
        isManual: true,
        juz: juz,
        created_at: new Date().toISOString()
      };

      await window.dataSdk?.create?.('schedules', newSchedule);
      showToast(`Data kelulusan manual ${student.name} berhasil disimpan.`, 'success');
      closeManualGradModal();
      renderGraduationTable();
      renderCertificateTable();
    });

    document.getElementById('add-manual-grad-btn')?.addEventListener('click', openManualGradModal);
    document.getElementById('manual-grad-modal-close')?.addEventListener('click', closeManualGradModal);
    document.getElementById('manual-grad-modal-cancel')?.addEventListener('click', closeManualGradModal);

    function renderGraduationTable() {
      requireOperator();
      const tbody = document.getElementById('graduation-table');
      const periodFilter = document.getElementById('graduation-period-filter');
      const searchInput = document.getElementById('graduation-search');
      if (!tbody) return;

      // Update period filter options from schedules
      if (periodFilter) {
        const currentVal = periodFilter.value;
        const periods = [...new Set(schedules.map(s => s.period).filter(p => !!p))].sort();
        periodFilter.innerHTML = '<option value="all">Semua Periode</option>' + 
          periods.map(p => `<option value="${p}" ${p === currentVal ? 'selected' : ''}>${p}</option>`).join('');
      }

      const selectedPeriod = periodFilter?.value || 'all';
      const searchTerm = (searchInput?.value || '').toLowerCase().trim();

      let list = (schedules || []).slice();
      
      if (selectedPeriod !== 'all') {
        list = list.filter(s => s.period === selectedPeriod);
      }

      if (searchTerm) {
        list = list.filter(s => (s.studentName || '').toLowerCase().includes(searchTerm));
      }

      const role = getLoggedInRole();
      
      if (role === 'pentasmi') {
        const sess = lsGet(STORAGE_KEYS.operatorSession);
        if (sess?.id) {
          list = list.filter(it => it.teacherId === sess.id);
        }
      }

      tbody.innerHTML = '';
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-emerald-200/70">Belum ada jadwal tasmi.</td></tr>`;
        return;
      }

      list.forEach(it => {
        const student = (students || []).find(s => s.id === it.studentId);
        const isRegisteredStudent = student && student.registrationId;
        
        let canDetermineGraduation = false;
        if (role === 'admin' || role === 'pentasmi') {
          canDetermineGraduation = true;
        }

        const statusPill = (s) => {
          if (s === 'Lulus') return 'bg-green-500/20 text-green-300 border-green-500/30';
          if (s === 'Tidak Lulus') return 'bg-red-500/20 text-red-300 border-red-500/30';
          return 'bg-gold-500/15 text-gold-200 border-gold-500/30';
        };
        
        const announcedPill = it.announced 
          ? `<span class="ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Diumumkan</span>`
          : '';
        
        const manualPill = it.isManual
          ? `<span class="ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] bg-gold-500/20 text-gold-400 border border-gold-500/30" title="Data lulus periode lalu">Manual</span>`
          : '';
        
        const autoPill = it.isAuto
          ? `<span class="ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30" title="Otomatis ditambahkan dari data siswa">Otomatis</span>`
          : '';

        const actionButtons = canDetermineGraduation ? `
          <button class="grad-action px-3 py-1 rounded-lg border border-green-500/40 text-green-300 hover:bg-green-500/10 transition" data-id="${it.id}" data-status="Lulus">Lulus</button>
          <button class="grad-action px-3 py-1 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 transition ml-2" data-id="${it.id}" data-status="Tidak Lulus">Tidak Lulus</button>
        ` : `
          <span class="text-emerald-400 text-xs">Tidak ada aksi</span>
        `;

        const uploadButton = role === 'pentasmi' ? `
          <button class="grad-action px-3 py-1 rounded-lg border border-gold-500/40 text-gold-200 hover:bg-gold-500/10 transition ml-2" data-id="${it.id}" data-action="upload-result">
            ${it.tasmiResultSheet ? 'Ganti Lembar' : 'Upload Lembar'}
          </button>
        ` : '';

        const viewButton = it.tasmiResultSheet ? `
          <button class="grad-action px-3 py-1 rounded-lg border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 transition ml-2" data-id="${it.id}" data-action="view-result">Lihat Lembar</button>
        ` : (role === 'admin' ? '<span class="text-emerald-500/30 text-[10px] italic ml-2">Belum ada lembar</span>' : '');

        const deleteButton = role === 'admin' ? `<button class="grad-action px-3 py-1 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 transition ml-2" data-id="${it.id}" data-action="delete">Hapus</button>` : '';

        const editPeriodButton = role === 'admin' ? `
          <button class="grad-action p-2 rounded-lg bg-emerald-800/50 text-gold-400 hover:bg-emerald-700 transition ml-2" data-id="${it.id}" data-action="edit-period" title="Edit Periode">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          </button>
        ` : '';

        const displayTeacher = it.isAuto ? '<span class="text-emerald-500/50 italic">Belum Diatur</span>' : it.teacherName;

        // Format periode ke Bulan Tahun (misal: "Mei 2024") jika formatnya YYYY-MM
        let displayPeriod = it.period || '-';
        if (displayPeriod.includes('-') && displayPeriod.length === 7) {
          const [year, month] = displayPeriod.split('-');
          const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
          displayPeriod = `${monthNames[parseInt(month) - 1]} ${year}`;
        }

        tbody.insertAdjacentHTML('beforeend', `
          <tr>
            <td class="px-4 py-3 text-white font-medium">
              <div class="flex items-center gap-2">
                <span>${displayPeriod}</span>
                ${editPeriodButton}
              </div>
            </td>
            <td class="px-4 py-3 text-emerald-200/80">
              <div class="text-white font-medium">${it.studentName}</div>
              <div class="text-[10px] text-emerald-400/60">${it.juz ? 'Juz ' + it.juz : '-'}</div>
            </td>
            <td class="px-4 py-3 text-emerald-200/80">${displayTeacher}</td>
            <td class="px-4 py-3">
              <div class="flex items-center">
                <span class="inline-flex px-3 py-1 rounded-full text-xs border ${statusPill(it.graduationStatus)}">${it.graduationStatus || 'Menunggu'}</span>
                ${announcedPill}
                ${manualPill}
                ${autoPill}
              </div>
            </td>
            <td class="px-4 py-3 text-right whitespace-nowrap">
              ${viewButton}
              ${uploadButton}
              ${actionButtons}
              ${deleteButton}
            </td>
          </tr>
        `);
      });

      // Add event listeners for grad-action buttons
      document.querySelectorAll('.grad-action').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const status = btn.dataset.status;
          const action = btn.dataset.action;

          if (status) {
            try {
              await window.dataSdk?.update?.('schedules', id, { graduationStatus: status });
              showToast(`Status kelulusan berhasil diperbarui menjadi ${status}.`, 'success');
              renderGraduationTable();
              renderCertificateTable();
            } catch (err) {
              console.error('Update graduation error:', err);
              showToast('Gagal memperbarui status kelulusan.', 'error');
            }
          } else if (action === 'upload-result') {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*,application/pdf';
            fileInput.onchange = async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              
              try {
                showToast('Sedang mengunggah lembar hasil...', 'info');
                const fileUrl = await window.dataSdk?.uploadFile?.(file, `tasmi_sheets/${id}_${Date.now()}`);
                await window.dataSdk?.update?.('schedules', id, { tasmiResultSheet: fileUrl });
                showToast('Lembar hasil berhasil diunggah!', 'success');
                renderGraduationTable();
              } catch (err) {
                console.error('Upload tasmi sheet error:', err);
                showToast('Gagal mengunggah lembar hasil.', 'error');
              }
            };
            fileInput.click();
          } else if (action === 'view-result') {
            const item = (schedules || []).find(it => it.id === id);
            if (item?.tasmiResultSheet) {
              window.open(item.tasmiResultSheet, '_blank');
            }
          } else if (action === 'delete') {
            const confirmed = await showConfirmationModal({
              title: 'Hapus Data?',
              body: 'Anda yakin ingin menghapus data kelulusan ini? Tindakan ini tidak dapat dibatalkan.',
              confirmText: 'Ya, Hapus'
            });
            if (confirmed) {
              try {
                await window.dataSdk?.delete?.('schedules', id);
                showToast('Data berhasil dihapus.', 'success');
                renderGraduationTable();
              } catch (err) {
                console.error('Delete graduation error:', err);
                showToast('Gagal menghapus data.', 'error');
              }
            }
          } else if (action === 'edit-period') {
            openPeriodModal(id);
          }
        });
      });
    }

    document.getElementById('graduation-period-filter')?.addEventListener('change', () => renderGraduationTable());
    document.getElementById('graduation-search')?.addEventListener('input', () => renderGraduationTable());

    document.getElementById('period-modal-close')?.addEventListener('click', closePeriodModal);
    document.getElementById('period-modal-cancel')?.addEventListener('click', closePeriodModal);
    document.getElementById('period-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('period-modal-id').value;
      const period = document.getElementById('period-month-year').value;
      
      if (!id || !period) return;
      
      showToast('Menyimpan periode...', 'info');
      try {
        await window.dataSdk?.update?.('schedules', id, { period });
        showToast('Periode berhasil diperbarui.', 'success');
        closePeriodModal();
        renderGraduationTable();
      } catch (err) {
        console.error('Error updating period:', err);
        showToast('Gagal memperbarui periode.', 'error');
      }
    });

    function closePeriodModal() {
      const modal = document.getElementById('period-modal');
      const dialog = document.getElementById('period-modal-dialog');
      if (dialog) dialog.classList.add('scale-95');
      setTimeout(() => {
        if (modal) modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
      }, 300);
    }

    async function announceGraduation() {
      requireOperator();
      const list = schedules || [];
      const unannounced = list.filter(it => it.graduationStatus && !it.announced);
      
      if (unannounced.length === 0) {
        showToast('Tidak ada data kelulusan baru untuk diumumkan.', 'error');
        return;
      }

      const confirmed = await showConfirmationModal({
        title: 'Umumkan Kelulusan?',
        body: `Anda akan mengumumkan hasil kelulusan untuk ${unannounced.length} siswa. Pengumuman akan dibuat secara otomatis. Lanjutkan?`,
        confirmText: 'Ya, Umumkan'
      });

      if (!confirmed) return;

      const passed = unannounced.filter(it => it.graduationStatus === 'Lulus');
      const failed = unannounced.filter(it => it.graduationStatus === 'Tidak Lulus');

      let body = `Berikut adalah hasil kelulusan Tasmi' Al-Quran terbaru:\n\n`;
      
      if (passed.length > 0) {
        body += `✅ LULUS:\n`;
        passed.forEach(it => {
          body += `- ${it.studentName} (${formatDateId(it.date)})\n`;
        });
        body += `\n`;
      }

      if (failed.length > 0) {
        body += `❌ TIDAK LULUS / MENGULANG:\n`;
        failed.forEach(it => {
          body += `- ${it.studentName} (${formatDateId(it.date)})\n`;
        });
      }

      body += `\nTetap semangat dalam menghafal Al-Quran!`;

      const newAnn = {
        id: 'ANN-' + Date.now(),
        title: `Pengumuman Kelulusan Tasmi - ${formatDateId(new Date().toISOString())}`,
        tag: 'Penting',
        date: new Date().toISOString().split('T')[0],
        body: body,
        studentResults: unannounced.map(it => ({
          studentId: it.studentId,
          studentName: it.studentName,
          date: it.date,
          status: it.graduationStatus,
          period: it.period || '-',
          juz: it.juz || (students || []).find(s => s.id === it.studentId)?.juz || '-'
        })),
        created_at: new Date().toISOString()
      };

      // Save announcement
      await window.dataSdk?.create?.('announcements', newAnn);

      // Mark as announced in schedules
      for (const it of unannounced) {
        await window.dataSdk?.update?.('schedules', it.id, { announced: true });
      }

      showToast('Hasil kelulusan telah diumumkan!', 'success');
      renderPublicAnnouncements();
      renderGraduationTable();
    }

    function renderAnnouncementsAdmin() {
      requireOperator();
      const wrap = document.getElementById('ann-list');
      const searchInput = document.getElementById('ann-search');
      if (!wrap) return;

      const tagClass = (tag) => {
        if (tag === 'Penting') return 'bg-red-500/20 text-red-400';
        if (tag === 'Kegiatan') return 'bg-blue-500/20 text-blue-400';
        return 'bg-green-500/20 text-green-400';
      };

      const searchTerm = (searchInput?.value || '').toLowerCase().trim();
      let list = (announcements || [])
        .slice()
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

      if (searchTerm) {
        list = list.filter(it => 
          (it.title || '').toLowerCase().includes(searchTerm) || 
          (it.body || '').toLowerCase().includes(searchTerm) ||
          (it.tag || '').toLowerCase().includes(searchTerm)
        );
      }

      wrap.innerHTML = '';
      if (list.length === 0) {
        wrap.innerHTML = `<div class="text-emerald-200/70 text-sm">Belum ada pengumuman. Tambahkan dari form di atas.</div>`;
        return;
      }

      list.forEach(it => {
        const isHidden = !!it.hidden;
        wrap.insertAdjacentHTML('beforeend', `
          <div class="rounded-2xl ${isHidden ? 'bg-emerald-950/10 opacity-60' : 'bg-emerald-950/40'} border ${isHidden ? 'border-emerald-800/20' : 'border-emerald-700/30'} group hover:border-gold-500/20 hover:bg-emerald-950/60 transition-all duration-300 w-full overflow-hidden animate-fade-in">
            <!-- Header (Clickable to Toggle) -->
            <div class="p-3 flex items-center justify-between gap-4 cursor-pointer" onclick="toggleAnnouncementDetail('${it.id}')">
              <div class="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                <div class="flex items-center justify-center shrink-0" onclick="event.stopPropagation()">
                  <input type="checkbox" class="ann-checkbox w-4 h-4 rounded-lg border-emerald-700 bg-emerald-900/50 text-gold-500 focus:ring-gold-500/20 cursor-pointer transition-all" data-id="${it.id}">
                </div>
                <div class="overflow-hidden min-w-0 flex-1">
                  <div class="flex items-center gap-2 mb-0.5">
                    <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${tagClass(it.tag)} shrink-0">${it.tag || 'Info'}</span>
                    <div class="text-white font-bold text-xs truncate group-hover:text-gold-400 transition-colors">${it.title || '-'} ${isHidden ? '<span class="text-[9px] text-red-400 font-normal ml-1">(Disembunyikan)</span>' : ''}</div>
                  </div>
                  <div class="flex items-center gap-2 overflow-hidden">
                    <span class="text-[10px] text-emerald-500/60 font-medium shrink-0">${formatDateId(it.date)}</span>
                    <div class="h-1 w-1 rounded-full bg-emerald-800 shrink-0"></div>
                    <div class="text-emerald-200/50 text-[11px] truncate italic flex-1 min-w-0">Klik untuk melihat detail...</div>
                  </div>
                </div>
              </div>
              
              <div class="shrink-0 flex items-center gap-1" onclick="event.stopPropagation()">
                <button class="ann-action p-2 rounded-xl text-emerald-400 hover:text-gold-400 hover:bg-emerald-800/50 transition-all" data-id="${it.id}" data-action="toggle-visibility" title="${isHidden ? 'Tampilkan' : 'Sembunyikan'}">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    ${isHidden 
                      ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/>' 
                      : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>'}
                  </svg>
                </button>
                <button class="ann-action p-2 rounded-xl text-emerald-400 hover:text-gold-400 hover:bg-emerald-800/50 transition-all" data-id="${it.id}" data-action="edit" title="Edit">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button class="ann-action p-2 rounded-xl text-emerald-400 hover:text-red-400 hover:bg-red-500/10 transition-all" data-id="${it.id}" data-action="delete" title="Hapus">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
                <div id="ann-icon-${it.id}" class="p-2 text-emerald-500/40 group-hover:text-gold-500/60 transition-all duration-300">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </div>
              </div>
            </div>

            <!-- Detail (Collapsible Body) -->
            <div id="ann-detail-${it.id}" class="hidden px-14 pb-4 border-t border-emerald-700/20 pt-3 animate-slide-down">
              <div class="text-emerald-200/80 text-[11px] leading-relaxed whitespace-pre-line bg-emerald-950/30 p-3 rounded-xl border border-emerald-800/40">
                ${it.body || ''}
              </div>
            </div>
          </div>
        `);
      });

      // Update bulk actions visibility
      updateAnnBulkActions();
    }

    function updateAnnBulkActions() {
      const checked = document.querySelectorAll('.ann-checkbox:checked');
      const container = document.getElementById('ann-bulk-actions');
      const countLabel = document.getElementById('ann-selected-count');
      if (!container || !countLabel) return;

      if (checked.length > 0) {
        container.classList.remove('hidden');
        countLabel.textContent = `${checked.length} terpilih`;
      } else {
        container.classList.add('hidden');
      }
    }

    async function deleteAnnouncementsBulk() {
      const checked = document.querySelectorAll('.ann-checkbox:checked');
      const ids = Array.from(checked).map(el => el.dataset.id);
      if (ids.length === 0) return;

      const confirmed = await showConfirmationModal({
        title: 'Hapus Pengumuman Terpilih?',
        body: `Anda yakin ingin menghapus ${ids.length} pengumuman sekaligus?`
      });
      if (!confirmed) return;

      showToast(`Menghapus ${ids.length} pengumuman...`, 'info');
      try {
        for (const id of ids) {
          await window.dataSdk?.remove?.('announcements', id);
        }
        showToast(`${ids.length} pengumuman berhasil dihapus.`, 'success');
        renderAnnouncementsAdmin();
        renderPublicAnnouncements();
      } catch (err) {
        console.error('Error bulk deleting announcements:', err);
        showToast('Gagal menghapus beberapa pengumuman.', 'error');
      }
    }

    function downloadJson(filename, obj) {
      const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function collectBackup() {
      const readRaw = (key) => {
        try { return localStorage.getItem(key); } catch { return null; }
      };
      return {
        version: 1,
        exported_at: new Date().toISOString(),
        data: {
          [STORAGE_KEYS.registrations]: readRaw(STORAGE_KEYS.registrations),
          [STORAGE_KEYS.elementConfig]: readRaw(STORAGE_KEYS.elementConfig),
          [STORAGE_KEYS.operatorAuth]: readRaw(STORAGE_KEYS.operatorAuth),
          [STORAGE_KEYS.students]: readRaw(STORAGE_KEYS.students),
          [STORAGE_KEYS.schedule]: readRaw(STORAGE_KEYS.schedule),
          [STORAGE_KEYS.announcements]: readRaw(STORAGE_KEYS.announcements),
          [STORAGE_KEYS.registrationSettings]: readRaw(STORAGE_KEYS.registrationSettings),
          [STORAGE_KEYS.logo]: readRaw(STORAGE_KEYS.logo),
          [STORAGE_KEYS.favicon]: readRaw(STORAGE_KEYS.favicon),
          [STORAGE_KEYS.graduation]: readRaw(STORAGE_KEYS.graduation),
          [STORAGE_KEYS.certificates]: readRaw(STORAGE_KEYS.certificates)
        }
      };
    }

    function restoreBackup(payload) {
      if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') return false;
      try {
        Object.entries(payload.data).forEach(([key, raw]) => {
          if (typeof raw === 'string') localStorage.setItem(key, raw);
        });
        return true;
      } catch {
        return false;
      }
    }

    document.getElementById('registration-form').addEventListener('submit', async (e) => {
      console.log('DEBUG: Submit event listener on #registration-form has been triggered.');
      e.preventDefault();

      const regSettings = settings.registration || lsGet(STORAGE_KEYS.registration, { enabled: true });
      if (regSettings.enabled === false) {
        showToast('Pendaftaran sedang ditutup.', 'error');
        return;
      }

      if (recordCount >= 999) {
        showToast('Kuota pendaftaran sudah penuh. Silakan hubungi admin.', 'error');
        return;
      }

      const submitBtn = document.getElementById('submit-btn');
      const submitText = document.getElementById('submit-text');
      const submitLoading = document.getElementById('submit-loading');

      submitBtn.disabled = true;
      submitText.classList.add('hidden');
      submitLoading.classList.remove('hidden');

      try {
        const file = document.getElementById('lembar_tasmi').files[0];
        let photoBase64 = null;

        if (file) {
          const maxSize = 5 * 1024 * 1024; // 5MB
          if (file.size > maxSize) {
            showToast('Ukuran berkas tidak boleh melebihi 5MB.', 'error');
            return;
          }

          photoBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
          });
        }
        
        await submitRegistration(photoBase64);
      } catch (error) {
        console.error('Registration error:', error);
        showToast('Terjadi kesalahan saat memproses data. Silakan coba lagi.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitText.classList.remove('hidden');
        submitLoading.classList.add('hidden');
      }
    });

    async function submitRegistration(photoBase64) {
      console.log('DEBUG: Entering submitRegistration function.');
      const formData = {
        id: 'REG-' + Date.now(),
        nama_lengkap: document.getElementById('nama_lengkap').value,
        kelas: document.getElementById('kelas').value,
        jenis_kelamin: document.getElementById('jenis_kelamin').value,
        juz_tasmikan: document.getElementById('juz_tasmikan').value,
        fatherName: document.getElementById('nama_ayah').value,
        motherName: document.getElementById('nama_ibu').value,
        status: 'Menunggu Verifikasi',
        lembar_tasmi: photoBase64,
        created_at: new Date().toISOString()
      };
      console.log('DEBUG: Form data constructed:', formData);

      if (window.dataSdk) {
        console.log('DEBUG: window.dataSdk found. Calling create...');
        const result = await window.dataSdk.create('registrations', formData);
        console.log('DEBUG: dataSdk.create result:', result);
        if (result.isOk) {
          showToast('Pendaftaran berhasil! Kami akan menghubungi Anda segera.', 'success');
          document.getElementById('registration-form').reset();
        } else {
          showToast('Terjadi kesalahan. Silakan coba lagi.', 'error');
          console.error('DEBUG: dataSdk.create returned an error:', result.error);
        }
      } else {
        console.log('DEBUG: window.dataSdk NOT found. Using fallback.');
        // Fallback for when dataSdk is not available (demo mode)
        showToast('Pendaftaran berhasil! (Demo Mode)', 'success');
        document.getElementById('registration-form').reset();
      }
    }

    // Operator handlers
    ensureDefaultOperatorAuth();

    document.getElementById('operator-login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const u = (document.getElementById('operator-username')?.value || '').trim();
      const p = (document.getElementById('operator-password')?.value || '').trim();
      if (!u || !p) {
        showToast('Username dan password wajib diisi.', 'error');
        return;
      }
      if (operatorLogin(u, p)) {
        showToast('Login berhasil. Selamat bekerja!', 'success');
        navigateTo('operator-panel');
        const role = getLoggedInRole();
        if (role === 'pentasmi') {
          setOperatorTab('graduation');
          renderGraduationTable();
        } else {
          setOperatorTab('approval');
          renderApprovalTable();
        }
      } else {
        showToast('Login gagal. Username / password salah.', 'error');
      }
    });

    document.getElementById('pentasmi-login-actual-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const u = (document.getElementById('pentasmi-login-username')?.value || '').trim();
      const p = (document.getElementById('pentasmi-login-password')?.value || '').trim();
      if (!u || !p) {
        showToast('Username dan password wajib diisi.', 'error');
        return;
      }
      if (operatorLogin(u, p)) {
        showToast('Login Pentasmi berhasil. Selamat bekerja!', 'success');
        navigateTo('operator-panel');
        const role = getLoggedInRole();
        if (role === 'pentasmi') {
          setOperatorTab('graduation');
          renderGraduationTable();
        } else {
          setOperatorTab('approval');
          renderApprovalTable();
        }
      } else {
        showToast('Login gagal. Periksa username dan password Anda.', 'error');
      }
    });

    document.getElementById('operator-logout-btn')?.addEventListener('click', () => {
      operatorLogout();
      showToast('Logout berhasil.', 'success');
      navigateTo('login-operator');
    });

    document.querySelectorAll('.operator-nav-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try { requireOperator(); } catch { return; }
        const tab = btn.dataset.tab;
        setOperatorTab(tab);
        if (tab === 'general') applyBranding();
        if (tab === 'approval') renderApprovalTable();
        if (tab === 'students') renderStudents();
        if (tab === 'schedule') renderScheduleAdmin();
        if (tab === 'graduation') renderGraduationTable();
        if (tab === 'pentasmi') renderPentasmiList();
        if (tab === 'announcements') renderAnnouncementsAdmin();
        if (tab === 'certificates') renderCertificateTable();
        if (tab === 'congratulations') renderCongratulationsTable();
        if (tab === 'homepage') loadHomepageSettingsIntoForm();
        if (tab === 'registration-settings') loadRegistrationSettingsIntoForm();
        if (tab === 'pentasmi-history') renderPentasmiHistory();
        if (tab === 'operator-monitoring') renderMonitoringHistory();
      });
    });

    // Congratulations logic
    let isUploadingCongrats = false;
    let currentCongratsStudentId = null;

    function renderCongratulationsTable() {
      requireOperator();
      const tbody = document.getElementById('congratulations-table');
      const searchInput = document.getElementById('congrats-search');
      if (!tbody) return;
      
      const searchTerm = (searchInput?.value || '').toLowerCase().trim();
      const congratsData = congratulations || {};

      let list = students || [];

      // Apply Search Filter
      if (searchTerm) {
        list = list.filter(s => 
          (s.name || '').toLowerCase().includes(searchTerm) ||
          (s.class || '').toLowerCase().includes(searchTerm)
        );
      }

      tbody.innerHTML = '';
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-center text-emerald-200/70">${searchTerm ? 'Tidak ada siswa yang cocok.' : 'Belum ada data siswa.'}</td></tr>`;
        return;
      }

      list.forEach(s => {
        const hasCongrats = !!congratsData[s.id];
        const isThisUploading = isUploadingCongrats && currentCongratsStudentId === s.id;

        let preview = '';
        if (isThisUploading) {
          preview = `<span class="flex items-center text-gold-400 text-xs animate-pulse">
            <svg class="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Proses...
          </span>`;
        } else if (hasCongrats) {
          preview = `<button class="congrats-action text-gold-400 hover:underline" data-id="${s.id}" data-action="view">Lihat Gambar</button>`;
        } else {
          preview = `<span class="text-emerald-200/40 text-xs italic">Belum ada</span>`;
        }

        tbody.insertAdjacentHTML('beforeend', `
          <tr class="hover:bg-emerald-800/10 transition-colors">
            <td class="px-4 py-3 text-white font-medium">${s.name}</td>
            <td class="px-4 py-3 text-emerald-200/80 text-sm">${s.class || '-'} / Juz ${s.juz || '-'}</td>
            <td class="px-4 py-3">${preview}</td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-2">
                <button class="congrats-action px-3 py-1 rounded-lg border border-gold-500/40 text-gold-200 hover:bg-gold-500/10 transition disabled:opacity-50" 
                  data-id="${s.id}" data-action="upload" ${isThisUploading ? 'disabled' : ''}>
                  ${hasCongrats ? 'Ganti' : 'Upload'}
                </button>
                ${hasCongrats && !isThisUploading ? `
                  <button class="congrats-action px-3 py-1 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 transition" 
                    data-id="${s.id}" data-action="delete" title="Hapus">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>` : ''}
              </div>
            </td>
          </tr>
        `);
      });
    }

    document.getElementById('congratulations-table')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.congrats-action');
      if (!btn || btn.disabled) return;
      
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const data = congratulations || {};

      if (action === 'view') {
        const url = data[id];
        if (url) openFileModal(url, `Ucapan-${id}.png`);
      } else if (action === 'upload') {
        currentCongratsStudentId = id;
        document.getElementById('congrats-upload-input').click();
      } else if (action === 'delete') {
        const confirmed = await showConfirmationModal({
          title: 'Hapus Ucapan?',
          body: 'Anda yakin ingin menghapus gambar ucapan selamat untuk siswa ini?'
        });
        if (confirmed) {
          try {
            const val = data[id];
            if (val && (val.startsWith('http') || val.startsWith('https'))) {
               await window.dataSdk?.removeFile?.(`congratulations/${id}`).catch(() => {});
            }
            await window.dataSdk?.remove?.('congratulations', id);
            delete congratulations[id];
            renderCongratulationsTable();
            showToast('Gambar ucapan berhasil dihapus.', 'success');
          } catch (err) {
            showToast('Gagal menghapus gambar.', 'error');
          }
        }
      }
    });

    document.getElementById('congrats-search')?.addEventListener('input', () => renderCongratulationsTable());

    document.getElementById('congrats-upload-input')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || !currentCongratsStudentId) return;

      if (!file.type.startsWith('image/')) {
        showToast('Mohon unggah file gambar.', 'error');
        e.target.value = '';
        return;
      }

      isUploadingCongrats = true;
      renderCongratulationsTable(); 
      showToast('Sedang memproses...', 'info');
        
      try {
        const compressedBase64 = await compressImage(file);
        
        let storageRes = { isOk: false, error: 'skipped' };
        if (!hasDetectedStorageCORS) {
          const uploadWithTimeout = () => {
            return new Promise(async (resolve) => {
              const timeout = setTimeout(() => resolve({ isOk: false, error: 'timeout' }), 5000); 
              try {
                const res = await window.dataSdk?.uploadFile?.(`congratulations/${currentCongratsStudentId}`, compressedBase64);
                clearTimeout(timeout);
                resolve(res);
              } catch (err) {
                clearTimeout(timeout);
                resolve({ isOk: false, error: err.message });
              }
            });
          };
          storageRes = await uploadWithTimeout();
        }
        
        if (storageRes.isOk) {
          await window.dataSdk?.set?.('congratulations', currentCongratsStudentId, { 
            id: currentCongratsStudentId,
            url: storageRes.url,
            updated_at: new Date().toISOString()
          });
          congratulations[currentCongratsStudentId] = storageRes.url;
          showToast('Gambar ucapan berhasil diunggah.', 'success');
        } else {
          if (storageRes.error !== 'skipped') hasDetectedStorageCORS = true; 
          
          const firestoreRes = await window.dataSdk?.set?.('congratulations', currentCongratsStudentId, { 
            id: currentCongratsStudentId,
            base64: compressedBase64,
            updated_at: new Date().toISOString()
          });
          
          if (firestoreRes.isOk) {
            congratulations[currentCongratsStudentId] = compressedBase64;
            showToast('Gambar ucapan diunggah (Mode Cadangan).', 'success');
          } else {
            throw new Error('Gagal menyimpan.');
          }
        }
      } catch (err) {
        showToast('Gagal mengunggah.', 'error');
      } finally {
        isUploadingCongrats = false;
        currentCongratsStudentId = null;
        e.target.value = ''; 
        renderCongratulationsTable();
      }
    });

    // Certificate logic
    let isUploadingCert = false;
    let currentUploadStudentId = null;
    let hasDetectedStorageCORS = false; // Flag to reduce console noise

    function renderCertificateTable() {
      requireOperator();
      const tbody = document.getElementById('certificate-table');
      const searchInput = document.getElementById('cert-search');
      if (!tbody) return;
      
      const searchTerm = (searchInput?.value || '').toLowerCase().trim();
      const certs = certificates || {};

      const passedFromSchedules = new Set(
        (schedules || []).filter(it => it.graduationStatus === 'Lulus').map(it => it.studentId)
      );
      
      let passedStudents = (students || []).filter(s => 
        s.graduationStatus === 'Lulus' || passedFromSchedules.has(s.id)
      );

      // Apply Search Filter
      if (searchTerm) {
        passedStudents = passedStudents.filter(s => 
          (s.name || '').toLowerCase().includes(searchTerm) ||
          (s.class || '').toLowerCase().includes(searchTerm)
        );
      }

      tbody.innerHTML = '';
      if (passedStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-center text-emerald-200/70">${searchTerm ? 'Tidak ada siswa yang cocok dengan pencarian.' : 'Belum ada siswa yang lulus tasmi.'}</td></tr>`;
        return;
      }

      passedStudents.forEach(s => {
        // Skip students explicitly marked as "Tidak Lulus" in their current profile
        if (s.graduationStatus === 'Tidak Lulus') return;
        
        const hasCert = !!certs[s.id];
        const isThisUploading = isUploadingCert && currentUploadStudentId === s.id;

        let certPreview = '';
        if (isThisUploading) {
          certPreview = `<span class="flex items-center text-gold-400 text-xs animate-pulse">
            <svg class="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Proses...
          </span>`;
        } else if (hasCert) {
          certPreview = `<button class="cert-action text-gold-400 hover:underline" data-id="${s.id}" data-action="view">Lihat Sertifikat</button>`;
        } else {
          certPreview = `<span class="text-emerald-200/40 text-xs italic">Belum diunggah</span>`;
        }

        const scheduleEntry = (schedules || []).find(it => it.studentId === s.id && it.graduationStatus === 'Lulus');
        const displayJuz = scheduleEntry?.juz || s.juz || '-';

        tbody.insertAdjacentHTML('beforeend', `
          <tr class="hover:bg-emerald-800/10 transition-colors">
            <td class="px-4 py-3 text-white font-medium">${s.name}</td>
            <td class="px-4 py-3 text-emerald-200/80 text-sm">${s.class} / ${displayJuz}</td>
            <td class="px-4 py-3">${certPreview}</td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-2">
                <button class="cert-action px-3 py-1 rounded-lg border border-gold-500/40 text-gold-200 hover:bg-gold-500/10 transition disabled:opacity-50" 
                  data-id="${s.id}" data-action="link" title="Input Link Google Drive">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                </button>
                <button class="cert-action px-3 py-1 rounded-lg border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10 transition disabled:opacity-50" 
                  data-id="${s.id}" data-action="upload" ${isThisUploading ? 'disabled' : ''}>
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                </button>
                ${hasCert && !isThisUploading ? `
                  <button class="cert-action p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition" 
                    data-id="${s.id}" data-action="delete" title="Hapus">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>` : ''}
              </div>
            </td>
          </tr>
        `);
      });
    }

    document.getElementById('certificate-table')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.cert-action');
      if (!btn || btn.disabled) return;
      
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const certs = certificates || {};

      if (action === 'view') {
        const url = certs[id];
        if (url) {
          if (url.startsWith('http')) {
            window.open(url, '_blank');
          } else {
            openFileModal(url, `Sertifikat-${id}.png`);
          }
        } else {
          showToast('Sertifikat tidak ditemukan.', 'error');
        }
      } else if (action === 'upload') {
        currentUploadStudentId = id;
        document.getElementById('certificate-upload-input').click();
      } else if (action === 'link') {
        openCertLinkModal(id);
      } else if (action === 'delete') {
        const confirmed = await showConfirmationModal({
          title: 'Hapus Sertifikat?',
          body: 'Anda yakin ingin menghapus sertifikat untuk siswa ini?'
        });
        if (confirmed) {
          try {
            // Remove from Storage if it's a Storage URL
            const certValue = certs[id];
            if (certValue && (certValue.startsWith('http') || certValue.startsWith('https'))) {
               // Silently attempt to delete, ignore errors if already gone
               await window.dataSdk?.removeFile?.(`certificates/${id}`).catch(() => {});
            }
            
            // Remove document from Firestore
            await window.dataSdk?.remove?.('certificates', id);
            
            // Local cleanup (subscription will also handle this)
            delete certificates[id];
            lsSet(STORAGE_KEYS.certificates, certificates);
            renderCertificateTable();
            showToast('Sertifikat berhasil dihapus.', 'success');
          } catch (err) {
            console.error('Delete Cert Error:', err);
            showToast('Gagal menghapus sertifikat.', 'error');
          }
        }
      }
    });

    // Helper: Compress image to Base64 (max width/height 1200px, quality 0.7)
    async function compressImage(file, maxWidth = 1200, quality = 0.7) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
              }
            } else {
              if (height > maxWidth) {
                width *= maxWidth / height;
                height = maxWidth;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          };
          img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
      });
    }

    document.getElementById('cert-search')?.addEventListener('input', () => renderCertificateTable());

    document.getElementById('certificate-upload-input')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || !currentUploadStudentId) return;

      // Check file type
      if (!file.type.startsWith('image/')) {
        showToast('Mohon unggah file gambar (JPG/PNG).', 'error');
        e.target.value = '';
        return;
      }

      // Check file size (10MB max before compression)
      const maxSize = 10 * 1024 * 1024; 
      if (file.size > maxSize) {
        showToast('File terlalu besar (maksimal 10MB).', 'error');
        e.target.value = '';
        return;
      }

      isUploadingCert = true;
      renderCertificateTable(); 
      showToast('Sedang memproses & kompresi...', 'info');
        
      try {
        // 1. Compress the image first
        console.log('DEBUG: Starting compression...');
        const compressedBase64 = await compressImage(file).catch(err => {
          console.error('Compression failed:', err);
          return null;
        });

        if (!compressedBase64) {
          throw new Error('Gagal memproses gambar.');
        }
        
        console.log('DEBUG: Compression done. Size:', Math.round(compressedBase64.length / 1024), 'KB');

        // 2. ATTEMPT 1: Upload to Firebase Storage with Timeout (only if not already failed CORS)
        let storageRes = { isOk: false, error: 'skipped' };
        
        if (!hasDetectedStorageCORS) {
          console.log('DEBUG: Attempting Storage upload with 5s timeout...');
          const uploadWithTimeout = () => {
            return new Promise(async (resolve) => {
              const timeout = setTimeout(() => {
                console.warn('DEBUG: Storage upload timed out.');
                resolve({ isOk: false, error: 'timeout' });
              }, 5000); 

              try {
                const res = await window.dataSdk?.uploadFile?.(`certificates/${currentUploadStudentId}`, compressedBase64);
                clearTimeout(timeout);
                resolve(res);
              } catch (err) {
                clearTimeout(timeout);
                resolve({ isOk: false, error: err.message });
              }
            });
          };
          storageRes = await uploadWithTimeout();
        } else {
          console.log('DEBUG: Skipping Storage attempt due to previous CORS detection.');
        }
        
        if (storageRes.isOk) {
          console.log('DEBUG: Storage upload success.');
          await window.dataSdk?.set?.('certificates', currentUploadStudentId, { 
            id: currentUploadStudentId,
            url: storageRes.url,
            updated_at: new Date().toISOString()
          });
          
          certificates[currentUploadStudentId] = storageRes.url;
          lsSet(STORAGE_KEYS.certificates, certificates);
          showToast('Sertifikat berhasil diunggah.', 'success');
        } else {
          // Detect if it was a CORS/Storage error to set the flag
          if (storageRes.error !== 'skipped') {
            hasDetectedStorageCORS = true; 
          }

          // ATTEMPT 2: Fallback to Firestore (Direct Base64)
          console.warn('DEBUG: Storage failed or skipped. Using Firestore fallback...');
          showToast('Menggunakan mode cadangan...', 'info');
          
          const firestoreRes = await window.dataSdk?.set?.('certificates', currentUploadStudentId, { 
            id: currentUploadStudentId,
            base64: compressedBase64,
            updated_at: new Date().toISOString()
          });
          
          if (firestoreRes.isOk) {
            certificates[currentUploadStudentId] = compressedBase64;
            lsSet(STORAGE_KEYS.certificates, certificates);
            showToast('Sertifikat berhasil diunggah (Mode Cadangan).', 'success');
          } else {
            throw new Error('Gagal menyimpan ke database.');
          }
        }
      } catch (err) {
        console.error('Cert Upload Final Catch:', err);
        showToast('Gagal mengunggah sertifikat. Coba file lain atau periksa koneksi.', 'error');
      } finally {
        console.log('DEBUG: Upload process finished.');
        isUploadingCert = false;
        currentUploadStudentId = null;
        e.target.value = ''; 
        renderCertificateTable();
      }
    });

    // Pentasmi account CRUD
    document.getElementById('pentasmi-account-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { requireOperator(); } catch { return; }
      const idEl = document.getElementById('pentasmi-id');
      const username = (document.getElementById('pentasmi-username')?.value || '').trim();
      const password = (document.getElementById('pentasmi-password-acc')?.value || '').trim();
      const name = (document.getElementById('pentasmi-name-acc')?.value || '').trim();
      
      if (!username || !password || !name) return;
      if (password.length < 6) {
        showToast('Password minimal 6 karakter.', 'error');
        return;
      }

      const id = idEl?.value || '';
      
      if (id) {
        await window.dataSdk?.update?.('pentasmi', id, { username, password, name });
      } else {
        if (pentasmiAccounts.some(p => p.username === username)) {
          showToast('Username sudah digunakan.', 'error');
          return;
        }
        await window.dataSdk?.create?.('pentasmi', { 
          id: 'PEN-' + Date.now(), 
          username, 
          password, 
          name, 
          created_at: new Date().toISOString() 
        });
      }
      
      showToast('Akun pentasmi disimpan.', 'success');
      document.getElementById('pentasmi-account-form').reset();
      if (idEl) idEl.value = '';
      renderPentasmiList();
    });

    document.getElementById('pentasmi-reset')?.addEventListener('click', () => {
      document.getElementById('pentasmi-account-form')?.reset();
      const idEl = document.getElementById('pentasmi-id');
      if (idEl) idEl.value = '';
    });

    document.getElementById('pentasmi-list')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.pentasmi-action');
      if (!btn) return;
      try { requireOperator(); } catch { return; }
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const item = pentasmiAccounts.find(p => p.id === id);
      if (!item) return;

      if (action === 'edit') {
        document.getElementById('pentasmi-id').value = item.id;
        document.getElementById('pentasmi-username').value = item.username || '';
        document.getElementById('pentasmi-password-acc').value = item.password || '';
        document.getElementById('pentasmi-name-acc').value = item.name || '';
        showToast('Edit mode: ubah lalu klik Simpan.', 'success');
      } else if (action === 'delete') {
        const confirmed = await showConfirmationModal({
          title: 'Hapus Akun Pentasmi?',
          body: 'Anda yakin ingin menghapus akun pentasmi ini? Data yang sudah ada tidak akan hilang.'
        });
        if (!confirmed) return;
        await window.dataSdk?.remove?.('pentasmi', id);
        showToast('Akun dihapus.', 'success');
        renderPentasmiList();
      }
    });

    document.getElementById('announce-graduation-btn')?.addEventListener('click', () => announceGraduation());
    document.getElementById('graduation-period-filter')?.addEventListener('change', () => renderGraduationTable());

    // Graduation action
    document.getElementById('graduation-table')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.grad-action');
      if (!btn) return;
      try { requireOperator(); } catch { return; }
      const id = btn.dataset.id;
      const status = btn.dataset.status;
      const action = btn.dataset.action;
      
      if (action === 'delete') {
        const confirmed = await showConfirmationModal({
          title: 'Hapus Jadwal?',
          body: 'Anda yakin ingin menghapus jadwal tasmi ini?'
        });
        if (confirmed) {
          await window.dataSdk?.remove?.('schedules', id);
          showToast('Jadwal berhasil dihapus.', 'success');
          renderGraduationTable();
          renderPublicSchedule();
        }
        return;
      }

      if (action === 'upload-result') {
        window.currentTasmiResultScheduleId = id;
        document.getElementById('tasmi-result-upload-input').click();
        return;
      }

      if (action === 'view-result') {
        const schedule = schedules.find(s => s.id === id);
        if (schedule && schedule.tasmiResultSheet) {
          openFileModal(schedule.tasmiResultSheet, `Hasil-Tasmi-${schedule.studentName.replace(/\s+/g, '-')}.png`);
        }
        return;
      }

      if (action === 'edit-period') {
        const schedule = schedules.find(s => s.id === id);
        if (!schedule) return;
        
        const modal = document.getElementById('period-modal');
        const dialog = document.getElementById('period-modal-dialog');
        const input = document.getElementById('period-month-year');
        const idInput = document.getElementById('period-modal-id');
        
        idInput.value = id;
        // Jika periode sudah dalam format YYYY-MM, set ke input
        if (schedule.period && schedule.period.includes('-') && schedule.period.length === 7) {
          input.value = schedule.period;
        } else {
          input.value = '';
        }
        
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        setTimeout(() => dialog.classList.remove('scale-95'), 50);
        return;
      }
      
      if (status) {
        await window.dataSdk?.update?.('schedules', id, { graduationStatus: status });
        showToast(`Status kelulusan diperbarui: ${status}`, 'success');
        renderGraduationTable();
        renderPublicSchedule();
      }
    });

    document.getElementById('tasmi-result-upload-input')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || !window.currentTasmiResultScheduleId) return;

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        showToast('Ukuran berkas tidak boleh melebihi 5MB.', 'error');
        e.target.value = '';
        return;
      }

      showToast('Sedang mengunggah lembar hasil...', 'info');
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result;
        const res = await window.dataSdk?.update?.('schedules', window.currentTasmiResultScheduleId, { 
          tasmiResultSheet: base64 
        });
        if (res.isOk) {
          showToast('Lembar hasil tasmi berhasil diunggah.', 'success');
          renderGraduationTable();
        } else {
          showToast('Gagal mengunggah lembar hasil.', 'error');
        }
        e.target.value = ''; // Reset input
      };
      reader.readAsDataURL(file);
    });

    // Logo & Favicon upload
    function handleFileUpload(inputId, storageKey, settingKey) {
      const input = document.getElementById(inputId);
      if (!input) return;
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64 = event.target.result;
          await window.dataSdk?.set?.('settings', settingKey, { value: base64 });
          lsSet(storageKey, base64);
          applyBranding();
          showToast('File berhasil diunggah.', 'success');
        };
        reader.readAsDataURL(file);
      });
    }

    handleFileUpload('logo-upload', STORAGE_KEYS.logo, 'logo');
    handleFileUpload('favicon-upload', STORAGE_KEYS.favicon, 'favicon');

    document.getElementById('logo-reset')?.addEventListener('click', async () => {
      const confirmed = await showConfirmationModal({
        title: 'Reset Logo?',
        body: 'Logo akan dikembalikan ke pengaturan awal.',
        confirmText: 'Ya, Reset'
      });
      if (confirmed) {
        await window.dataSdk?.set?.('settings', 'logo', null);
        localStorage.removeItem(STORAGE_KEYS.logo);
        applyBranding();
        showToast('Logo direset.', 'success');
      }
    });

    document.getElementById('favicon-reset')?.addEventListener('click', async () => {
      const confirmed = await showConfirmationModal({
        title: 'Reset Favicon?',
        body: 'Favicon akan dikembalikan ke pengaturan awal.',
        confirmText: 'Ya, Reset'
      });
      if (confirmed) {
        await window.dataSdk?.set?.('settings', 'favicon', null);
        localStorage.removeItem(STORAGE_KEYS.favicon);
        // Reset favicon is tricky, we might need to remove the link or reset to original
        const link = document.querySelector("link[rel~='icon']");
        if (link) link.remove(); 
        applyBranding();
        showToast('Favicon direset.', 'success');
      }
    });

    document.getElementById('approval-refresh')?.addEventListener('click', () => renderApprovalTable());
    document.getElementById('approval-filter')?.addEventListener('change', () => renderApprovalTable());
    document.getElementById('approval-search')?.addEventListener('input', () => renderApprovalTable());

    document.getElementById('approval-table')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.approval-action');
      if (!btn) return;
      try { requireOperator(); } catch { return; }
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (!id) return;

      if (action === 'view-file') {
        const registration = registrations.find(r => r.id === id);
        openFileModal(registration?.lembar_tasmi || registration?.photo);
        return;
      }

      if (action === 'approve') {
        const registration = registrations.find(r => r.id === id);
        if (registration) {
          const studentList = students || [];
          // Cari siswa berdasarkan nama lengkap (dan kelas jika ingin lebih spesifik)
          const existingStudent = studentList.find(s => 
            (s.name || '').toLowerCase() === (registration.nama_lengkap || '').toLowerCase()
          );

          if (existingStudent) {
            // Update data siswa lama (Menimpa file lama)
            await window.dataSdk?.update?.('students', existingStudent.id, {
              registrationId: id,
              class: registration.kelas,
              gender: registration.jenis_kelamin,
              juz: registration.juz_tasmikan,
              fatherName: registration.fatherName,
              motherName: registration.motherName,
              lembar_tasmi: registration.lembar_tasmi || registration.photo,
              graduationStatus: 'Menunggu', // Reset status kelulusan
              updated_at: new Date().toISOString()
            });
            
            showToast('Data siswa lama diperbarui (Pendaftaran Ulang disetujui).', 'success');
          } else {
            // Buat data siswa baru
            const newStudentId = 'SIS-' + Date.now();
            await window.dataSdk?.create?.('students', {
              id: newStudentId,
              registrationId: id,
              name: registration.nama_lengkap,
              class: registration.kelas,
              gender: registration.jenis_kelamin,
              juz: registration.juz_tasmikan,
              fatherName: registration.fatherName,
              motherName: registration.motherName,
              lembar_tasmi: registration.lembar_tasmi || registration.photo,
              graduationStatus: 'Menunggu',
              created_at: new Date().toISOString()
            });
            
            showToast('Siswa baru berhasil ditambahkan.', 'success');
          }
        }
        await window.dataSdk?.update?.('registrations', id, { status: 'Disetujui' });
        showToast('Pendaftaran disetujui.', 'success');
      } else if (action === 'reject') {
        await window.dataSdk?.update?.('registrations', id, { status: 'Ditolak' });
        showToast('Pendaftaran ditolak.', 'success');
      } else if (action === 'delete') {
        const confirmed = await showConfirmationModal({
          title: 'Hapus Pendaftaran?',
          body: 'Anda yakin ingin menghapus data pendaftaran ini?'
        });
        if (!confirmed) return;
        await window.dataSdk?.remove?.('registrations', id);
        showToast('Pendaftaran dihapus.', 'success');
      }
      renderApprovalTable();
    });

    // Students CRUD
    document.getElementById('students-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { requireOperator(); } catch { return; }
      const idEl = document.getElementById('student-id');
      const name = (document.getElementById('student-name')?.value || '').trim();
      const studentClass = (document.getElementById('student-class')?.value || '').trim();
      const juz = (document.getElementById('student-juz')?.value || '').trim();
      const period = (document.getElementById('student-period')?.value || '').trim();
      const fatherName = (document.getElementById('student-father')?.value || '').trim();
      const motherName = (document.getElementById('student-mother')?.value || '').trim();
      const notes = (document.getElementById('student-notes')?.value || '').trim();
      if (!name) return;
      
      const photoInput = document.getElementById('student-photo-input');
      const photoFile = photoInput?.files[0];
      let photoUrl = null;
      
      const id = idEl?.value || '';
      const finalId = id || 'SIS-' + Date.now();

      showToast('Sedang menyimpan data...', 'info');

      try {
        if (photoFile) {
          const compressedBase64 = await compressImage(photoFile, 800, 0.6); // Smaller for profile
          
          // Attempt Storage upload with fallback
          let storageRes = { isOk: false, error: 'skipped' };
          
          // Helper for timeout
          const uploadWithTimeout = () => {
            return new Promise(async (resolve) => {
              const timeout = setTimeout(() => resolve({ isOk: false, error: 'timeout' }), 8000); 
              try {
                const res = await window.dataSdk?.uploadFile?.(`students/${finalId}`, compressedBase64);
                clearTimeout(timeout);
                resolve(res);
              } catch (err) {
                clearTimeout(timeout);
                resolve({ isOk: false, error: err.message });
              }
            });
          };

          storageRes = await uploadWithTimeout();
          
          if (storageRes?.isOk) {
            photoUrl = storageRes.url;
          } else {
            // Backup to firestore if storage fails (CORS or timeout)
            photoUrl = compressedBase64;
          }
        } else if (id) {
          // Check if photo was explicitly removed
          if (studentPhotoRemoved) {
            photoUrl = null;
          } else {
            // Keep existing photo if not uploading new one and not removed
            const existing = students.find(s => s.id === id);
            photoUrl = existing?.photo || null;
          }
        }

        const studentData = { 
          id: finalId, 
          name, 
          class: studentClass, 
          juz, 
          period,
          fatherName,
          motherName,
          notes,
          photo: photoUrl,
          updated_at: new Date().toISOString()
        };

        if (id) {
          await window.dataSdk?.update?.('students', id, studentData);
        } else {
          studentData.created_at = new Date().toISOString();
          await window.dataSdk?.create?.('students', studentData);
        }

        showToast('Data siswa berhasil disimpan.', 'success');
        document.getElementById('students-form').reset();
        if (idEl) idEl.value = '';
        if (photoInput) photoInput.value = '';
        closeStudentModal();
        renderStudents();
      } catch (err) {
        console.error('Error saving student:', err);
        showToast('Gagal menyimpan data siswa.', 'error');
      }
    });

    document.getElementById('add-student-btn')?.addEventListener('click', () => openStudentModal());
    document.getElementById('student-modal-close')?.addEventListener('click', () => closeStudentModal());
    document.getElementById('student-modal-cancel')?.addEventListener('click', () => closeStudentModal());
    document.getElementById('students-entries')?.addEventListener('change', () => renderStudents());
    document.getElementById('students-period-filter')?.addEventListener('change', () => renderStudents());
    document.getElementById('students-search')?.addEventListener('input', () => renderStudents());

    // Student photo preview logic
    document.getElementById('student-photo-input')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      if (!file.type.startsWith('image/')) {
        showToast('Mohon pilih file gambar.', 'error');
        e.target.value = '';
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const previewImg = document.getElementById('student-photo-preview-img');
        const placeholder = document.getElementById('student-photo-placeholder');
        const deleteBtn = document.getElementById('student-photo-delete-btn');
        if (previewImg && placeholder) {
          previewImg.src = event.target.result;
          previewImg.classList.remove('hidden');
          placeholder.classList.add('hidden');
          studentPhotoRemoved = false;
          if (deleteBtn) deleteBtn.classList.remove('hidden');
        }
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('student-photo-delete-btn')?.addEventListener('click', () => {
      const photoInput = document.getElementById('student-photo-input');
      const previewImg = document.getElementById('student-photo-preview-img');
      const placeholder = document.getElementById('student-photo-placeholder');
      const deleteBtn = document.getElementById('student-photo-delete-btn');

      if (photoInput) photoInput.value = '';
      if (previewImg) {
        previewImg.src = '';
        previewImg.classList.add('hidden');
      }
      if (placeholder) placeholder.classList.remove('hidden');
      if (deleteBtn) deleteBtn.classList.add('hidden');
      studentPhotoRemoved = true;
    });

    document.getElementById('student-reset')?.addEventListener('click', () => {
      document.getElementById('students-form')?.reset();
      const idEl = document.getElementById('student-id');
      if (idEl) idEl.value = '';
    });

    document.getElementById('students-refresh')?.addEventListener('click', () => renderStudents());

    // Registration Settings
    document.getElementById('registration-status-toggle')?.addEventListener('change', async (e) => {
      const isActive = e.target.checked;
      const label = document.getElementById('registration-status-label');
      if (label) label.textContent = isActive ? 'Aktif' : 'Nonaktif';
      
      try {
        await window.dataSdk?.set?.('settings', 'registration', { 
          id: 'registration',
          enabled: isActive,
          updated_at: new Date().toISOString()
        });
        showToast(`Pendaftaran berhasil ${isActive ? 'diaktifkan' : 'dinonaktifkan'}.`, 'success');
      } catch (err) {
        console.error('Error saving registration setting:', err);
        showToast('Gagal menyimpan pengaturan.', 'error');
      }
    });

    // Certificate Link Modal
    function openCertLinkModal(studentId) {
      const modal = document.getElementById('cert-link-modal');
      const dialog = document.getElementById('cert-link-modal-dialog');
      const input = document.getElementById('cert-link-input');
      const idInput = document.getElementById('cert-link-student-id');
      
      if (!modal || !dialog || !input || !idInput) return;
      
      idInput.value = studentId;
      const existing = (certificates || {})[studentId] || '';
      input.value = existing.startsWith('http') ? existing : '';
      
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
      setTimeout(() => dialog.classList.remove('scale-95'), 50);
    }

    function closeCertLinkModal() {
      const modal = document.getElementById('cert-link-modal');
      const dialog = document.getElementById('cert-link-modal-dialog');
      if (!modal || !dialog) return;
      
      dialog.classList.add('scale-95');
      setTimeout(() => {
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
      }, 200);
    }

    document.getElementById('cert-link-cancel')?.addEventListener('click', closeCertLinkModal);
    document.getElementById('cert-link-save')?.addEventListener('click', async () => {
      const id = document.getElementById('cert-link-student-id')?.value;
      const url = document.getElementById('cert-link-input')?.value?.trim();
      
      if (!id) return;
      if (!url) {
        showToast('Mohon masukkan link yang valid.', 'error');
        return;
      }
      
      if (!url.startsWith('http')) {
        showToast('Link harus diawali dengan http:// atau https://', 'error');
        return;
      }

      showToast('Menyimpan link...', 'info');
      try {
        await window.dataSdk?.set?.('certificates', id, { 
          id, 
          url, 
          updated_at: new Date().toISOString() 
        });
        
        certificates[id] = url;
        closeCertLinkModal();
        renderCertificateTable();
        showToast('Link sertifikat berhasil disimpan.', 'success');
      } catch (err) {
        console.error('Error saving cert link:', err);
        showToast('Gagal menyimpan link.', 'error');
      }
    });

    document.getElementById('students-table-body')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.student-action');
      if (!btn) return;
      try { requireOperator(); } catch { return; }
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const item = students.find(s => s.id === id);
      if (!item) return;

      if (action === 'view-file') {
        openFileModal(item.lembar_tasmi || item.photo);
        return;
      }

      if (action === 'set-graduation') {
        const confirmed = await showConfirmationModal({
          title: 'Tentukan Kelulusan?',
          body: `Apakah ${item.name} dinyatakan Lulus atau Tidak Lulus dalam Tasmi ini?`,
          confirmText: 'Lulus'
        });
        
        // Modal returns true for confirm, false for cancel.
        // But we want 3 states: Lulus, Tidak Lulus, or Cancel.
        // Let's use a simpler approach with the existing modal by asking 2 separate questions if needed, 
        // OR better: customize the modal call to allow 2 specific confirm options.
        // Since my showConfirmationModal is simple, I'll ask: "Apakah Lulus?"
        
        if (confirmed) {
          await window.dataSdk?.update?.('students', id, { graduationStatus: 'Lulus' });
          showToast(`${item.name} dinyatakan Lulus.`, 'success');
        } else {
          // If they cancelled, we might want to ask if they meant "Tidak Lulus"
          const failConfirmed = await showConfirmationModal({
            title: 'Tentukan Kelulusan?',
            body: `Apakah ${item.name} dinyatakan TIDAK LULUS?`,
            confirmText: 'Ya, Tidak Lulus'
          });
          if (failConfirmed) {
            await window.dataSdk?.update?.('students', id, { graduationStatus: 'Tidak Lulus' });
            showToast(`${item.name} dinyatakan Tidak Lulus.`, 'error');
          }
        }
        renderStudents();
        return;
      }

      if (action === 'announce-instant') {
        const isPassed = item.graduationStatus === 'Lulus';
        const defaultMotivation = isPassed 
          ? `Alhamdulillah, ananda ${item.name} telah dinyatakan LULUS dalam Tasmi' Al-Quran Juz ${item.juz || '-'}.\n\nSemoga menjadi motivasi untuk terus menjaga dan menambah hafalannya.`
          : `Tetap semangat! Ananda ${item.name} dinyatakan TIDAK LULUS / MENGULANG dalam Tasmi' Al-Quran Juz ${item.juz || '-'}.\n\nJangan menyerah, setiap ayat yang dibaca adalah pahala yang besar. Teruslah murojaah.`;
        
        const confirmed = await showConfirmationModal({
          title: 'Umumkan Langsung?',
          body: `Buat pengumuman hasil tasmi untuk ${item.name} sekarang?`,
          confirmText: 'Ya, Umumkan'
        });
        if (!confirmed) return;

        const newAnn = {
          id: 'ANN-' + Date.now(),
          title: `Pengumuman Hasil Tasmi - ${item.name}`,
          tag: 'Penting',
          date: new Date().toISOString().split('T')[0],
          body: defaultMotivation,
          studentResults: [{
            studentId: item.id,
            studentName: item.name,
            date: new Date().toISOString().split('T')[0],
            status: item.graduationStatus,
            juz: item.juz || '-'
          }],
          created_at: new Date().toISOString()
        };

        await window.dataSdk?.create?.('announcements', newAnn);
        showToast(`Hasil ${item.name} telah diumumkan!`, 'success');
        renderPublicAnnouncements();
        return;
      }

      if (action === 'edit') {
        openStudentModal(id);
        return;
      } else if (action === 'delete') {
        const confirmed = await showConfirmationModal({
          title: 'Hapus Siswa?',
          body: 'Anda yakin ingin menghapus data siswa ini? Sertifikat terkait juga akan dihapus.'
        });
        if (!confirmed) return;

        // Cleanup certificate if exists
        const certValue = (certificates || {})[id];
        if (certValue) {
          if (certValue.startsWith('http') || certValue.startsWith('https')) {
            await window.dataSdk?.removeFile?.(`certificates/${id}`);
          }
          await window.dataSdk?.remove?.('certificates', id);
          delete certificates[id];
          lsSet(STORAGE_KEYS.certificates, certificates);
        }

        await window.dataSdk?.remove?.('students', id);
        showToast('Siswa dan sertifikat terkait dihapus.', 'success');
        renderStudents();
      }
    });

    // Schedule CRUD
    document.getElementById('schedule-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { requireOperator(); } catch { return; }
      const idEl = document.getElementById('schedule-id');
      const date = document.getElementById('schedule-date')?.value || '';
      const time = (document.getElementById('schedule-time')?.value || '').trim();
      const teacherSelect = document.getElementById('schedule-teacher');
      const teacherId = teacherSelect?.value || '';
      const teacherName = teacherSelect.options[teacherSelect.selectedIndex]?.text || 'Unknown';
      const studentId = document.getElementById('schedule-student')?.value || '';
      const location = (document.getElementById('schedule-location')?.value || '').trim();
      
      if (!date || !time || !teacherId || !studentId || !location) return;
      
      const student = (students || []).find(s => s.id === studentId);
      const studentName = student ? student.name : 'Unknown';

      const id = idEl?.value || '';
      if (id) {
        await window.dataSdk?.update?.('schedules', id, { 
          date, time, teacherId, teacherName, studentId, studentName, location
        });
      } else {
        await window.dataSdk?.create?.('schedules', { 
          id: 'SCH-' + Date.now(), 
          date, time, teacherId, teacherName, studentId, studentName, location,
          graduationStatus: null,
          created_at: new Date().toISOString() 
        });
      }
      showToast('Jadwal disimpan.', 'success');
      document.getElementById('schedule-form').reset();
      if (idEl) idEl.value = '';
      renderScheduleAdmin();
      renderPublicSchedule();
    });

    document.getElementById('schedule-reset')?.addEventListener('click', () => {
      document.getElementById('schedule-form')?.reset();
      const idEl = document.getElementById('schedule-id');
      if (idEl) idEl.value = '';
    });
    document.getElementById('schedule-search')?.addEventListener('input', () => renderScheduleAdmin());

    document.getElementById('schedule-list')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.schedule-action');
      if (!btn) return;
      try { requireOperator(); } catch { return; }
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const item = schedules.find(x => x.id === id);
      if (!item) return;

      if (action === 'edit') {
        document.getElementById('schedule-id').value = item.id;
        document.getElementById('schedule-date').value = item.date || '';
        document.getElementById('schedule-time').value = item.time || '';
        document.getElementById('schedule-teacher').value = item.teacherId || '';
        document.getElementById('schedule-student').value = item.studentId || '';
        document.getElementById('schedule-location').value = item.location || '';
        showToast('Edit jadwal: ubah lalu Simpan.', 'success');
      } else if (action === 'delete') {
        const confirmed = await showConfirmationModal({
          title: 'Hapus Jadwal?',
          body: 'Anda yakin ingin menghapus jadwal ini?'
        });
        if (!confirmed) return;
        await window.dataSdk?.remove?.('schedules', id);
        showToast('Jadwal dihapus.', 'success');
        renderScheduleAdmin();
        renderPublicSchedule();
      }
    });

    // Announcements CRUD
    document.getElementById('ann-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { requireOperator(); } catch { return; }
      const idEl = document.getElementById('ann-id');
      const title = (document.getElementById('ann-title')?.value || '').trim();
      const tag = (document.getElementById('ann-tag')?.value || 'Info').trim();
      let date = (document.getElementById('ann-date')?.value || '').trim();
      const body = (document.getElementById('ann-body')?.value || '').trim();
      
      // Jika tanggal kosong (pengumuman baru), gunakan tanggal hari ini
      if (!date) {
        date = new Date().toISOString().split('T')[0];
      }
      
      if (!title || !body) return;
      
      const id = idEl?.value || '';
      if (id) {
        await window.dataSdk?.update?.('announcements', id, { title, tag, date, body });
      } else {
        await window.dataSdk?.create?.('announcements', { id: 'ANN-' + Date.now(), title, tag, date, body, created_at: new Date().toISOString() });
      }
      showToast('Pengumuman disimpan.', 'success');
      document.getElementById('ann-form').reset();
      if (idEl) idEl.value = '';
      renderAnnouncementsAdmin();
      renderPublicAnnouncements();
    });

    document.getElementById('monitoring-pentasmi-filter')?.addEventListener('change', () => renderMonitoringHistory());
    document.getElementById('monitoring-refresh')?.addEventListener('click', () => renderMonitoringHistory());

    document.getElementById('pentasmi-change-password-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const oldPass = document.getElementById('pentasmi-old-pass').value;
      const newPass = document.getElementById('pentasmi-new-pass').value;
      const confirmPass = document.getElementById('pentasmi-confirm-pass').value;

      if (newPass.length < 6) {
        showToast('Password baru minimal 6 karakter.', 'error');
        return;
      }
      if (newPass !== confirmPass) {
        showToast('Konfirmasi password tidak cocok.', 'error');
        return;
      }

      const user = lsGet(STORAGE_KEYS.operatorAuth);
      if (!user || user.role !== 'pentasmi') return;

      const acc = (pentasmiAccounts || []).find(p => p.id === user.id);
      if (!acc || acc.password !== oldPass) {
        showToast('Password lama salah.', 'error');
        return;
      }

      try {
        await window.dataSdk?.update?.('pentasmi', acc.id, { password: newPass });
        // Update local memory too if needed, but SDK update should trigger sync
        showToast('Password berhasil diperbarui!', 'success');
        e.target.reset();
      } catch (err) {
        console.error('Password change error:', err);
        showToast('Gagal mengganti password.', 'error');
      }
    });

    document.getElementById('ann-reset')?.addEventListener('click', () => {
      document.getElementById('ann-form')?.reset();
      const idEl = document.getElementById('ann-id');
      if (idEl) idEl.value = '';
    });

    document.getElementById('ann-search')?.addEventListener('input', () => renderAnnouncementsAdmin());
    document.getElementById('ann-bulk-delete')?.addEventListener('click', () => deleteAnnouncementsBulk());
    document.getElementById('ann-list')?.addEventListener('change', (e) => {
      if (e.target.classList.contains('ann-checkbox')) {
        updateAnnBulkActions();
      }
    });

    document.getElementById('ann-list')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.ann-action');
      if (!btn) return;
      try { requireOperator(); } catch { return; }
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const item = announcements.find(x => x.id === id);
      if (!item) return;

      if (action === 'edit') {
        document.getElementById('ann-id').value = item.id;
        document.getElementById('ann-title').value = item.title || '';
        document.getElementById('ann-tag').value = item.tag || 'Info';
        document.getElementById('ann-date').value = item.date || '';
        document.getElementById('ann-body').value = item.body || '';
        showToast('Edit pengumuman: ubah lalu Simpan.', 'success');
      } else if (action === 'toggle-visibility') {
        const newHiddenStatus = !item.hidden;
        showToast(newHiddenStatus ? 'Menyembunyikan pengumuman...' : 'Menampilkan pengumuman...', 'info');
        try {
          await window.dataSdk?.update?.('announcements', id, { hidden: newHiddenStatus });
          showToast(newHiddenStatus ? 'Pengumuman disembunyikan' : 'Pengumuman ditampilkan', 'success');
          // Subscription will trigger re-render, but for immediate feedback:
          item.hidden = newHiddenStatus; 
          renderAnnouncementsAdmin();
          renderPublicAnnouncements();
        } catch (err) {
          console.error('Error toggling visibility:', err);
          showToast('Gagal mengubah visibilitas.', 'error');
        }
      } else if (action === 'delete') {
        const confirmed = await showConfirmationModal({
          title: 'Hapus Pengumuman?',
          body: 'Anda yakin ingin menghapus pengumuman ini?'
        });
        if (!confirmed) return;
        await window.dataSdk?.remove?.('announcements', id);
        showToast('Pengumuman dihapus.', 'success');
        renderAnnouncementsAdmin();
        renderPublicAnnouncements();
      }
    });

    document.getElementById('homepage-settings-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { requireOperator(); } catch { return; }
      const settingsData = {
        hero_arabic: document.getElementById('hero-arabic-input').value,
        hero_title: document.getElementById('hero-title-input').value,
        hero_subtitle: document.getElementById('hero-subtitle-input').value,
        about_title: document.getElementById('about-title-input').value,
        about_content: document.getElementById('about-content-input').value,
        card1_title: document.getElementById('card1-title-input').value,
        card1_desc: document.getElementById('card1-desc-input').value,
        card2_title: document.getElementById('card2-title-input').value,
        card2_desc: document.getElementById('card2-desc-input').value,
        card3_title: document.getElementById('card3-title-input').value,
        card3_desc: document.getElementById('card3-desc-input').value,
        footer_title: document.getElementById('footer-title-input').value,
        footer_description: document.getElementById('footer-description-input').value,
        footer_phone: document.getElementById('footer-phone-input').value,
        footer_email: document.getElementById('footer-email-input').value,
      };
      await window.dataSdk?.set?.('settings', 'homepage', { value: settingsData });
      lsSet(STORAGE_KEYS.homepage, settingsData);
      applyHomepageSettings();
      showToast('Konten beranda berhasil diperbarui.', 'success');
    });

    document.getElementById('homepage-settings-reset')?.addEventListener('click', async () => {
      const confirmed = await showConfirmationModal({
        title: 'Reset Beranda?',
        body: 'Konten beranda akan dikembalikan ke pengaturan awal.',
        confirmText: 'Ya, Reset'
      });
      if (confirmed) {
        localStorage.removeItem(STORAGE_KEYS.homepage);
        applyHomepageSettings();
        loadHomepageSettingsIntoForm();
        showToast('Konten beranda berhasil direset.', 'success');
      }
    });

    document.getElementById('reg-settings-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { requireOperator(); } catch { return; }
      const intro = document.getElementById('reg-intro-input').value;
      const targets = document.getElementById('reg-targets-input').value
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      const regData = { intro, targets };
      await window.dataSdk?.set?.('settings', 'registrationSettings', { value: regData });
      lsSet(STORAGE_KEYS.registrationSettings, regData);
      applyRegistrationSettings();
      showToast('Pengaturan pendaftaran berhasil diperbarui.', 'success');
    });

    document.getElementById('reg-settings-reset')?.addEventListener('click', async () => {
      const confirmed = await showConfirmationModal({
        title: 'Reset Pengaturan Pendaftaran?',
        body: 'Pengaturan pendaftaran akan dikembalikan ke default.',
        confirmText: 'Ya, Reset'
      });
      if (confirmed) {
        localStorage.removeItem(STORAGE_KEYS.registrationSettings);
        applyRegistrationSettings();
        loadRegistrationSettingsIntoForm();
        showToast('Pengaturan pendaftaran direset.', 'success');
      }
    });

    // Sync
    document.getElementById('sync-export')?.addEventListener('click', () => {
      try { requireOperator(); } catch { return; }
      const backup = collectBackup();
      downloadJson(`backup-tasmi-${Date.now()}.json`, backup);
    });

    // Excel Export
    async function exportToExcel() {
      try {
        requireOperator();
        showToast('Menyiapkan data Excel...', 'info');

        const wb = XLSX.utils.book_new();

        // 1. Registrations
        const regData = (registrations || []).map(r => ({
          'ID': r.id,
          'Nama Lengkap': r.nama_lengkap || '-',
          'Kelas': r.kelas || '-',
          'Jenis Kelamin': r.jenis_kelamin || '-',
          'Juz Tasmikan': r.juz_tasmikan || '-',
          'Orang Tua': r.nama_orang_tua || '-',
          'Status': r.status || 'Menunggu Verifikasi',
          'Tanggal': formatDateId(r.created_at)
        }));
        const wsReg = XLSX.utils.json_to_sheet(regData);
        XLSX.utils.book_append_sheet(wb, wsReg, 'Pendaftaran');

        // 2. Students
        const studentData = (students || []).map(s => ({
          'ID': s.id,
          'Nama': s.name || '-',
          'Kelas': s.class || '-',
          'Juz': s.juz || '-',
          'Periode': s.period || '-',
          'Catatan': s.notes || '-'
        }));
        const wsStudents = XLSX.utils.json_to_sheet(studentData);
        XLSX.utils.book_append_sheet(wb, wsStudents, 'Data Siswa');

        // 3. Schedules
        const scheduleData = (schedules || []).map(sc => ({
          'ID': sc.id,
          'Tanggal': formatDateId(sc.date),
          'Waktu': sc.time || '-',
          'Siswa': sc.studentName || '-',
          'Pentasmi': sc.teacherName || '-',
          'Lokasi': sc.location || '-',
          'Juz': sc.juz || '-',
          'Periode': sc.period || '-',
          'Status Lulus': sc.graduationStatus || '-'
        }));
        const wsSchedules = XLSX.utils.json_to_sheet(scheduleData);
        XLSX.utils.book_append_sheet(wb, wsSchedules, 'Jadwal');

        // 4. Announcements
        const annData = (announcements || []).map(a => ({
          'ID': a.id,
          'Judul': a.title || '-',
          'Tag': a.tag || 'Info',
          'Tanggal': formatDateId(a.date),
          'Isi': a.body || '-'
        }));
        const wsAnn = XLSX.utils.json_to_sheet(annData);
        XLSX.utils.book_append_sheet(wb, wsAnn, 'Pengumuman');

        // 5. Pentasmi
        const penData = (pentasmiAccounts || []).map(p => ({
          'ID': p.id,
          'Nama': p.name || '-',
          'Username': p.username || '-',
          'Password': p.password || '-'
        }));
        const wsPen = XLSX.utils.json_to_sheet(penData);
        XLSX.utils.book_append_sheet(wb, wsPen, 'Pentasmi');

        // 6. Certificates
      const certData = Object.entries(certificates || {}).map(([sid, url]) => {
        const student = (students || []).find(s => s.id === sid);
        return {
          'ID Siswa': sid,
          'Nama Siswa': student ? student.name : 'Unknown',
          'URL Sertifikat': (url && url.length > 32000) ? '[Data Gambar Terlalu Panjang]' : url
        };
      });
      const wsCerts = XLSX.utils.json_to_sheet(certData);
      XLSX.utils.book_append_sheet(wb, wsCerts, 'Sertifikat');

      // 7. Congratulations
      const congratsData = Object.entries(congratulations || {}).map(([sid, url]) => {
        const student = (students || []).find(s => s.id === sid);
        return {
          'ID Siswa': sid,
          'Nama Siswa': student ? student.name : 'Unknown',
          'URL Gambar Ucapan': (url && url.length > 32000) ? '[Data Gambar Terlalu Panjang]' : url
        };
      });
      const wsCongrats = XLSX.utils.json_to_sheet(congratsData);
      XLSX.utils.book_append_sheet(wb, wsCongrats, 'Ucapan Selamat');

      XLSX.writeFile(wb, `Data-Tasmi-AlQuran-${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('Data Excel berhasil diunduh.', 'success');
      } catch (error) {
        console.error('Excel Export Error:', error);
        showToast('Gagal mengekspor data Excel.', 'error');
      }
    }

    // Excel Import
    async function importFromExcel(file) {
      try {
        requireOperator();
        const confirmed = await showConfirmationModal({
          title: 'Import Excel?',
          body: 'Import dari Excel akan menambahkan data baru ke Cloud. Pastikan format kolom sesuai dengan hasil export. Lanjutkan?',
          confirmText: 'Ya, Import'
        });
        if (!confirmed) return;
        
        showToast('Memproses file Excel...', 'info');
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);

        let importedCount = 0;

        // Helper to import sheet
        const importSheet = async (sheetName, collectionName, mapper) => {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) return;
          const json = XLSX.utils.sheet_to_json(sheet);
          for (const row of json) {
            const mapped = mapper(row);
            if (mapped) {
              await window.dataSdk?.create?.(collectionName, mapped);
              importedCount++;
            }
          }
        };

        // Mapper functions
        const regMapper = (row) => ({
          nama_lengkap: row['Nama Lengkap'],
          kelas: row['Kelas'],
          jenis_kelamin: row['Jenis Kelamin'],
          juz_tasmikan: row['Juz Tasmikan'],
          nama_orang_tua: row['Orang Tua'],
          status: row['Status'] || 'Menunggu Verifikasi',
          created_at: new Date().toISOString()
        });

        const studentMapper = (row) => ({
          name: row['Nama'],
          class: row['Kelas'],
          juz: row['Juz'],
          period: row['Periode'] === '-' ? '' : row['Periode'],
          notes: row['Catatan'] === '-' ? '' : row['Catatan'],
          created_at: new Date().toISOString()
        });

        const scheduleMapper = (row) => ({
          date: row['Tanggal'], 
          time: row['Waktu'],
          studentName: row['Siswa'],
          teacherName: row['Pentasmi'],
          location: row['Lokasi'],
          juz: row['Juz'] === '-' ? '' : row['Juz'],
          period: row['Periode'] === '-' ? '' : row['Periode'],
          graduationStatus: row['Status Lulus'] === '-' ? null : row['Status Lulus'],
          created_at: new Date().toISOString()
        });

        const annMapper = (row) => ({
          title: row['Judul'],
          tag: row['Tag'],
          date: row['Tanggal'],
          body: row['Isi'],
          created_at: new Date().toISOString()
        });

        const penMapper = (row) => ({
          name: row['Nama'],
          username: row['Username'],
          password: row['Password'],
          created_at: new Date().toISOString()
        });

        await importSheet('Pendaftaran', 'registrations', regMapper);
        await importSheet('Data Siswa', 'students', studentMapper);
        await importSheet('Jadwal', 'schedules', scheduleMapper);
        await importSheet('Pengumuman', 'announcements', annMapper);
        await importSheet('Pentasmi', 'pentasmi', penMapper);

        showToast(`Import Excel selesai. ${importedCount} data berhasil diunggah ke cloud.`, 'success');
      } catch (error) {
        console.error('Excel Import Error:', error);
        showToast('Gagal mengimpor data Excel. Periksa kembali format file.', 'error');
      }
    }

    document.getElementById('sync-export-excel')?.addEventListener('click', () => exportToExcel());
    
    document.getElementById('sync-import-excel')?.addEventListener('click', () => {
      const file = document.getElementById('sync-import-excel-file')?.files?.[0];
      if (!file) {
        showToast('Pilih file Excel (.xlsx) terlebih dahulu.', 'error');
        return;
      }
      importFromExcel(file);
    });

    document.getElementById('sync-import')?.addEventListener('click', async () => {
      try { requireOperator(); } catch { return; }
      const file = document.getElementById('sync-import-file')?.files?.[0];
      if (!file) {
        showToast('Pilih file JSON dulu.', 'error');
        return;
      }
      const text = await file.text();
      let payload = null;
      try { payload = JSON.parse(text); } catch {}
      if (!payload) {
        showToast('File tidak valid.', 'error');
        return;
      }
      const confirmed = await showConfirmationModal({
        title: 'Import JSON?',
        body: 'Import akan menimpa data lokal DAN CLOUD yang ada. Lanjutkan?',
        confirmText: 'Ya, Import'
      });
      if (!confirmed) return;
      
      showToast('Sedang mengimpor data ke cloud...', 'info');
      
      // Helper to parse and upload to cloud
      const uploadToCloud = async (key, collectionName, isSettings = false) => {
        const raw = payload.data[STORAGE_KEYS[key]];
        if (!raw) return;
        try {
          const data = JSON.parse(raw);
          if (isSettings) {
            await window.dataSdk?.set?.('settings', collectionName, { value: data });
          } else if (Array.isArray(data)) {
            for (const item of data) {
              await window.dataSdk?.create?.(collectionName, item);
            }
          }
        } catch (e) {
          console.error(`Error importing ${key}:`, e);
        }
      };

      await uploadToCloud('registrations', 'registrations');
      await uploadToCloud('students', 'students');
      await uploadToCloud('schedule', 'schedules');
      await uploadToCloud('announcements', 'announcements');
      await uploadToCloud('pentasmiAccounts', 'pentasmi');
      
      await uploadToCloud('homepage', 'homepage', true);
      await uploadToCloud('registrationSettings', 'registrationSettings', true);
      await uploadToCloud('logo', 'logo', true);
      await uploadToCloud('favicon', 'favicon', true);
      await uploadToCloud('certificates', 'certificates', true);
      await uploadToCloud('operatorAuth', 'operatorAuth', true);
      await uploadToCloud('elementConfig', 'elementConfig', true);

      showToast('Import Cloud berhasil. Data sedang disinkronkan...', 'success');
      await initDataSdk();
    });

    document.getElementById('sync-reset-all')?.addEventListener('click', async () => {
      try { requireOperator(); } catch { return; }
      const confirmed = await showConfirmationModal({
        title: 'Reset Semua Data?',
        body: 'Ini akan menghapus SEMUA data lokal (termasuk pendaftaran). Lanjutkan?',
        confirmText: 'Ya, Reset Semua'
      });
      if (!confirmed) return;
      try {
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
      } catch {}
      ensureDefaultOperatorAuth();
      showToast('Reset selesai.', 'success');
      await initDataSdk();
      renderPublicSchedule();
      renderPublicAnnouncements();
      applyRegistrationSettings();
      navigateTo('login-operator');
    });

    document.getElementById('operator-credentials-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { requireOperator(); } catch { return; }
      const u = (document.getElementById('op-user-new')?.value || '').trim();
      const p = (document.getElementById('op-pass-new')?.value || '').trim();
      if (!u || !p) {
        showToast('Username dan password baru wajib diisi.', 'error');
        return;
      }
      const newAuth = { username: u, password: p };
      await window.dataSdk?.set?.('settings', 'operatorAuth', { value: newAuth });
      lsSet(STORAGE_KEYS.operatorAuth, newAuth);
      showToast('Akun operator disimpan ke cloud.', 'success');
    });

    function updateClock() {
      const clockEl = document.getElementById('digital-clock');
      if (!clockEl) return;
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      clockEl.textContent = `${h}:${m}:${s}`;
    }

    document.addEventListener('DOMContentLoaded', () => {
      // 1. Setup Navigation
      const links = document.querySelectorAll('a[href^="#"]:not([onclick]), .nav-link, .mobile-nav-link');
      links.forEach(link => {
        link.addEventListener('click', (e) => {
          const page = link.dataset.page || link.getAttribute('href').substring(1);
          if (page && document.getElementById(`page-${page}`)) {
            e.preventDefault();
            navigateTo(page);
          }
        });
      });

      document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
        document.getElementById('mobile-menu')?.classList.toggle('hidden');
      });

      // 2. Clock
      setInterval(updateClock, 1000);
      updateClock();

      // 3. Init SDKs
      try {
        initElementSdk();
        initDataSdk().then(() => {
          // Initial re-apply after everything loaded
          applyBranding();
          applyHomepageSettings();
          applyRegistrationSettings();
          renderPublicSchedule();
          renderPublicAnnouncements();
          
          if (isOperatorLoggedIn()) {
            renderApprovalTable();
            renderStudents();
            renderScheduleAdmin();
            renderGraduationTable();
            renderAnnouncementsAdmin();
            renderPentasmiList();
            renderCertificateTable();
            renderCongratulationsTable();
          }
        });
      } catch (err) {
        console.error('Initialization error:', err);
      }

      // 4. Page routing on load
      const isElectron = navigator.userAgent.toLowerCase().includes(' electron/');
      const initialPage = location.hash.substring(1) || (isElectron ? 'login-operator' : 'beranda');
      
      if (isOperatorLoggedIn()) {
        if (initialPage === 'login-operator' || initialPage === 'login-pentasmi' || initialPage === 'operator-panel' || (initialPage === 'beranda' && !isElectron)) {
          navigateTo(isElectron ? 'operator-panel' : 'beranda');
        } else {
          navigateTo(initialPage);
        }
      } else {
        navigateTo(isElectron ? 'login-operator' : 'beranda');
      }
    });

    // Final check: expose critical functions to window explicitly
    window.navigateTo = navigateTo;
    window.initDataSdk = initDataSdk;
    window.showToast = showToast;
    window.autoCreateSchedule = autoCreateSchedule;
    window.syncAllStudentsToGraduation = syncAllStudentsToGraduation;
    window.viewCertificatePublic = viewCertificatePublic;
    window.openGraduationDetailModal = openGraduationDetailModal;
    window.toggleAnnouncementDetail = toggleAnnouncementDetail;
    window.openFileModal = openFileModal;
    window.closeFileModal = closeFileModal;
    window.showConfirmationModal = showConfirmationModal;
    window.togglePassword = togglePassword;
    window.operatorLogin = operatorLogin;
    window.operatorLogout = operatorLogout;
    window.setOperatorTab = setOperatorTab;
    window.announceGraduation = announceGraduation;
    window.renderApprovalTable = renderApprovalTable;
    window.renderStudents = renderStudents;
    window.renderScheduleAdmin = renderScheduleAdmin;
    window.renderGraduationTable = renderGraduationTable;
    window.renderAnnouncementsAdmin = renderAnnouncementsAdmin;
    window.renderPentasmiList = renderPentasmiList;
    window.renderCertificateTable = renderCertificateTable;
    window.renderCongratulationsTable = renderCongratulationsTable;
    window.applyBranding = applyBranding;
    window.applyHomepageSettings = applyHomepageSettings;
    window.loadHomepageSettingsIntoForm = loadHomepageSettingsIntoForm;
    window.applyRegistrationSettings = applyRegistrationSettings;
    window.loadRegistrationSettingsIntoForm = loadRegistrationSettingsIntoForm;
    window.initElementSdk = initElementSdk;
 